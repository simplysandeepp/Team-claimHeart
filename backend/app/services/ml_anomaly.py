import logging
import numpy as np

# In a live environment, sklearn would be installed. Assuming it exists or gracefully degrading.
try:
    from sklearn.ensemble import IsolationForest
except ImportError:
    IsolationForest = None

logger = logging.getLogger(__name__)

class AnomalyScorer:
    """
    ML Isolation Forest anomaly scoring engine.
    Finds multivariate outliers across numeric vectors (amount, confidence, hospital days).
    """
    def __init__(self):
        self.model = None
        self._fit_mock_model()

    def _fit_mock_model(self):
        """
        Pre-fits the Isolation Forest on synthetic but realistic baseline data.
        In production, this would load a serialized .pkl model trained on DB1.
        """
        if not IsolationForest:
            logger.warning("scikit-learn is not available. ML Anomaly scoring disabled.")
            return

        # Feature shape: [claim_amount, ocr_confidence, hospital_days]
        # Generate clean baseline data
        np.random.seed(42)
        normal_amounts = np.random.normal(50000, 15000, 200)
        normal_confidence = np.random.normal(0.9, 0.05, 200)
        normal_days = np.random.normal(3, 1, 200)
        
        # Clip ranges to be realistic
        normal_amounts = np.clip(normal_amounts, 5000, 300000)
        normal_confidence = np.clip(normal_confidence, 0.7, 1.0)
        normal_days = np.clip(normal_days, 1, 14)
        
        X_train = np.column_stack((normal_amounts, normal_confidence, normal_days))

        self.model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
        self.model.fit(X_train)
        logger.info("Isolation Forest ML model successfully loaded and fitted.")

    def run_inference(self, claim_amount: float, ocr_confidence: float, hospital_days: int) -> dict:
        """
        Returns anomaly detection results. 
        If is_outlier is True, the features sit outside normal multidimensional clusters.
        """
        if not self.model:
            return {"is_outlier": False, "score": 0.0}

        # Handle missing vectors cleanly
        amount = claim_amount if claim_amount is not None else 50000
        conf = ocr_confidence if ocr_confidence is not None else 0.85
        days = hospital_days if hospital_days is not None else 2

        X_test = np.array([[amount, conf, days]])
        
        # Predict: 1 for inliers, -1 for outliers
        prediction = self.model.predict(X_test)[0]
        # anomaly score is between arbitrary negative and positive bounds. Lower is more abnormal.
        raw_score = self.model.score_samples(X_test)[0] 

        is_outlier = bool(prediction == -1)
        
        return {
            "is_outlier": is_outlier,
            "raw_score": raw_score,
            "features": {
                "claim_amount": amount,
                "ocr_confidence": conf,
                "hospital_days": days
            }
        }

ml_anomaly_scorer = AnomalyScorer()
