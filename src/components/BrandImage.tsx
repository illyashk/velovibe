import React, { useState } from 'react';

interface BrandImageProps {
  src: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
}

export const BrandImage: React.FC<BrandImageProps> = ({ src, fallbackSrc, alt, className }) => {
  const [imageSrc, setImageSrc] = useState(src);

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (imageSrc !== fallbackSrc) setImageSrc(fallbackSrc);
      }}
    />
  );
};
