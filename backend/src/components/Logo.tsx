import Image from "next/image";

export function Logo({
  small = false
}: {
  small?: boolean;
}) {
  return (
    <Image
      src="/brand/brand-logo.png"
      alt="SportyFanz"
      width={small ? 150 : 190}
      height={small ? 50 : 64}
      priority
      style={{
        objectFit: "contain",
        objectPosition: "left center"
      }}
    />
  );
}