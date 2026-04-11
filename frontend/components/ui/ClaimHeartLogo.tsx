import Image from "next/image";

type ClaimHeartLogoProps = {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  alt?: string;
};

export default function ClaimHeartLogo({
  className = "",
  imageClassName = "",
  priority = false,
  alt = "ClaimHeart logo",
}: ClaimHeartLogoProps) {
  const wrapperClassName = ["relative shrink-0 overflow-hidden", className].filter(Boolean).join(" ");
  const logoClassName = ["object-contain object-center", imageClassName].filter(Boolean).join(" ");

  return (
    <div className={wrapperClassName}>
      <Image
        src="/assets/claimHeartLogo.png"
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 768px) 48px, 64px"
        className={logoClassName}
      />
    </div>
  );
}
