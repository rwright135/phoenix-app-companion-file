"use client";
import Image from "next/image";
import { useState } from "react";
import { Icon } from "./Icon";
export function aircraftImageSource(image: string) {
  return image.startsWith("/") ? image : image ? "/assets/" + image : null;
}
export function AircraftImage({
  image,
  name,
}: {
  image: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = aircraftImageSource(image);
  if (!src || failed)
    return (
      <div
        className="aircraft-image-placeholder"
        role="img"
        aria-label={`${name}: photo unavailable`}
      >
        <Icon name="plane" />
        <span>Photo unavailable</span>
      </div>
    );
  return (
    <Image
      src={src}
      alt={name}
      width={1200}
      height={706}
      sizes="(max-width: 800px) 100vw, 600px"
      quality={75}
      unoptimized={src.startsWith("/api/")}
      onError={() => setFailed(true)}
    />
  );
}
