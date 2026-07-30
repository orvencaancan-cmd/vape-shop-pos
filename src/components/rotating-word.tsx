"use client";

import { useEffect, useState } from "react";

export function RotatingWord({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, 2200);
    return () => clearInterval(id);
  }, [words.length]);

  const longest = words.reduce((a, b) => (a.length > b.length ? a : b));

  return (
    <span className="relative inline-block align-bottom text-primary">
      <span className="invisible" aria-hidden="true">
        {longest}
      </span>
      {words.map((word, i) => (
        <span
          key={word}
          aria-hidden={i === index ? undefined : true}
          className={`absolute inset-0 transition-all duration-500 ${
            i === index ? "opacity-100" : "translate-y-1 opacity-0"
          }`}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
