"""
Groq LLM Client with Load Balancing and Fallback
Supports multiple API keys with automatic rotation and retry logic
"""

import json
import logging
import os
import random
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)


@dataclass
class GroqAPIKey:
    """Represents a Groq API key with usage tracking"""

    key: str
    index: int
    failures: int = 0
    last_used: float = 0.0
    is_active: bool = True


class GroqRateLimitError(Exception):
    """Raised when Groq API rate limit is exceeded"""

    pass


class GroqAPIError(Exception):
    """Raised when Groq API returns an error"""

    pass


class GroqClient:
    """
    Production-ready Groq LLM client with:
    - Load balancing across multiple API keys
    - Automatic fallback on failure
    - Rate limit handling
    - Retry logic with exponential backoff
    """

    BASE_URL = "https://api.groq.com/openai/v1"
    DEFAULT_MODEL = "llama-3.3-70b-versatile"
    MAX_RETRIES = 3
    TIMEOUT = 60.0

    def __init__(
        self,
        api_keys: Optional[List[str]] = None,
        model: Optional[str] = None,
        timeout: float = TIMEOUT,
    ):
        """
        Initialize Groq client with multiple API keys

        Args:
            api_keys: List of Groq API keys (if None, loads from env)
            model: Default model to use
            timeout: Request timeout in seconds
        """
        self.model = model or os.getenv("GROQ_MODEL", self.DEFAULT_MODEL)
        self.timeout = timeout

        # Load API keys from environment if not provided
        if api_keys is None:
            api_keys = self._load_keys_from_env()

        if not api_keys:
            raise ValueError(
                "No Groq API keys provided. Set GROQ_API_KEY_1, GROQ_API_KEY_2, etc."
            )

        # Initialize key pool
        self.keys: List[GroqAPIKey] = [
            GroqAPIKey(key=key, index=i) for i, key in enumerate(api_keys)
        ]

        logger.info(f"Initialized Groq client with {len(self.keys)} API keys")

    def _load_keys_from_env(self) -> List[str]:
        """Load API keys from environment variables"""
        keys = []
        for i in range(1, 10):  # Support up to 9 keys
            key = os.getenv(f"GROQ_API_KEY_{i}")
            if key and key.strip() and not key.startswith("gsk_placeholder"):
                keys.append(key.strip())
        return keys

    def _select_key(self) -> GroqAPIKey:
        """
        Select the best API key using round-robin with failure tracking

        Returns:
            GroqAPIKey: Selected API key
        """
        active_keys = [k for k in self.keys if k.is_active]

        if not active_keys:
            # Reset all keys if all are inactive
            logger.warning("All keys inactive, resetting failure counts")
            for key in self.keys:
                key.is_active = True
                key.failures = 0
            active_keys = self.keys

        # Sort by last_used time (least recently used first)
        active_keys.sort(key=lambda k: k.last_used)

        # Select least recently used key
        selected = active_keys[0]
        selected.last_used = time.time()

        logger.debug(f"Selected API key #{selected.index + 1}")
        return selected

    def _mark_key_failed(self, key: GroqAPIKey):
        """Mark a key as failed and deactivate if too many failures"""
        key.failures += 1
        logger.warning(f"API key #{key.index + 1} failed (count: {key.failures})")

        if key.failures >= 3:
            key.is_active = False
            logger.error(f"API key #{key.index + 1} deactivated after 3 failures")

    @retry(
        retry=retry_if_exception_type((GroqRateLimitError, httpx.TimeoutException)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    def _make_request(
        self,
        endpoint: str,
        payload: Dict[str, Any],
        key: GroqAPIKey,
    ) -> Dict[str, Any]:
        """
        Make HTTP request to Groq API with retry logic

        Args:
            endpoint: API endpoint path
            payload: Request payload
            key: API key to use

        Returns:
            Response JSON

        Raises:
            GroqRateLimitError: If rate limit exceeded
            GroqAPIError: If API returns error
        """
        url = f"{self.BASE_URL}/{endpoint}"
        headers = {
            "Authorization": f"Bearer {key.key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(url, json=payload, headers=headers)

                # Handle rate limiting
                if response.status_code == 429:
                    logger.warning(f"Rate limit hit for key #{key.index + 1}")
                    raise GroqRateLimitError("Rate limit exceeded")

                # Handle other errors
                if response.status_code >= 400:
                    error_detail = response.text
                    logger.error(
                        f"Groq API error {response.status_code}: {error_detail}"
                    )
                    raise GroqAPIError(
                        f"API error {response.status_code}: {error_detail}"
                    )

                return response.json()

        except httpx.TimeoutException as e:
            logger.error(f"Request timeout for key #{key.index + 1}")
            raise

        except Exception as e:
            logger.error(f"Request failed: {e}")
            raise GroqAPIError(f"Request failed: {e}")

    def complete(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.0,
        max_tokens: int = 2048,
        json_mode: bool = False,
    ) -> str:
        """
        Generate completion using Groq LLM with automatic fallback

        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
            temperature: Sampling temperature (0.0 = deterministic)
            max_tokens: Maximum tokens to generate
            json_mode: Force JSON output format

        Returns:
            Generated text response

        Raises:
            GroqAPIError: If all keys fail
        """
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        # Try with multiple keys until success
        last_error = None
        for attempt in range(len(self.keys)):
            key = self._select_key()

            try:
                response = self._make_request("chat/completions", payload, key)
                content = response["choices"][0]["message"]["content"]

                logger.info(
                    f"Completion successful with key #{key.index + 1} "
                    f"(tokens: {response.get('usage', {}).get('total_tokens', 'unknown')})"
                )

                return content

            except (GroqRateLimitError, GroqAPIError) as e:
                last_error = e
                self._mark_key_failed(key)
                logger.warning(
                    f"Attempt {attempt + 1} failed, trying next key: {e}"
                )
                continue

        # All keys failed
        raise GroqAPIError(
            f"All API keys failed after {len(self.keys)} attempts. Last error: {last_error}"
        )

    def complete_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.0,
        max_tokens: int = 2048,
    ) -> Dict[str, Any]:
        """
        Generate JSON completion

        Args:
            prompt: User prompt
            system_prompt: System prompt
            temperature: Sampling temperature
            max_tokens: Maximum tokens

        Returns:
            Parsed JSON response
        """
        response = self.complete(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=True,
        )

        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.debug(f"Raw response: {response}")
            raise GroqAPIError(f"Invalid JSON response: {e}")


# Global singleton instance
_groq_client: Optional[GroqClient] = None


def get_groq_client() -> GroqClient:
    """
    Get or create global Groq client instance

    Returns:
        GroqClient: Singleton client instance
    """
    global _groq_client

    if _groq_client is None:
        _groq_client = GroqClient()

    return _groq_client
