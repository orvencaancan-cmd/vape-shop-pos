"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import {
  SLIDES,
  PreviewShell,
  PANEL_COMPONENTS,
  type SlideKey,
} from "@/components/landing-preview-panels";

// Transition is split in half: fade the old slide out over the first half,
// swap content while invisible, fade the new slide in over the second half
// -- so headline word, headline second line, and the preview panel all
// cross-fade in sync since they share one state.
const TRANSITION_MS = 1200;
const DWELL_MS = 5500;

export function HeroSection() {
  const [index, setIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [userSelected, setUserSelected] = useState(false);

  useEffect(() => {
    if (userSelected) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setVisible(false);
      setIndex((i) => (i + 1) % SLIDES.length);
    }, DWELL_MS);
    return () => clearInterval(id);
  }, [userSelected]);

  // Swap the displayed slide only once faded out, then fade the new one in
  // -- this effect only schedules async work, it never calls setState
  // synchronously in its own body.
  useEffect(() => {
    const t = setTimeout(() => {
      setDisplayIndex(index);
      setVisible(true);
    }, TRANSITION_MS / 2);
    return () => clearTimeout(t);
  }, [index]);

  function selectSlide(key: SlideKey) {
    setUserSelected(true);
    setVisible(false);
    setIndex(SLIDES.findIndex((s) => s.key === key));
  }

  const slide = SLIDES[displayIndex];
  const Panel = PANEL_COMPONENTS[slide.key];
  const fadeStyle = {
    opacity: visible ? 1 : 0,
    transitionDuration: `${TRANSITION_MS / 2}ms`,
  };

  return (
    <section className="mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
      <div>
        <p className="animate-fade-in-up flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          Built for vape shops
        </p>
        <h1 className="animate-fade-in-up heading mt-3 text-4xl sm:text-6xl">
          <span className="block">
            Track your{" "}
            <span
              className="inline-block text-primary transition-opacity ease-in-out"
              style={fadeStyle}
            >
              {slide.word}
            </span>
          </span>
          <span
            className="mt-1 block text-2xl font-semibold text-body transition-opacity ease-in-out sm:text-3xl"
            style={fadeStyle}
          >
            {slide.headline2}
          </span>
        </h1>
        <p
          className="animate-fade-in-up mt-5 max-w-xl text-lg text-body"
          style={{ animationDelay: "80ms" }}
        >
          Track e-juice flavors, nicotine strengths, and sizes, ring up sales
          that deduct stock automatically, and see what&apos;s low — from
          your phone or your computer.
        </p>
        <div
          className="animate-fade-in-up mt-8 flex gap-3"
          style={{ animationDelay: "160ms" }}
        >
          <Link href="/signup" className={buttonClasses("primary", "md")}>
            Start your free trial
          </Link>
          <Link href="/login" className={buttonClasses("secondary", "md")}>
            Log in
          </Link>
        </div>
        <p className="animate-fade-in-up mt-4 text-sm text-muted" style={{ animationDelay: "160ms" }}>
          14 days free · no card required to start
        </p>
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
        <PreviewShell tabs={SLIDES} activeKey={slide.key} onSelect={selectSlide}>
          <div className="transition-opacity ease-in-out" style={fadeStyle}>
            <Panel />
          </div>
        </PreviewShell>
      </div>
    </section>
  );
}
