"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type MemoryType = "text" | "image" | "video" | "voice";

interface Memory {
  id: number;
  type: MemoryType;
  name: string;
  content: string;
  preview: string;
  created_at?: string;
}

const BUCKETS: Record<Exclude<MemoryType, "text">, string> = {
  image: "images",
  video: "videos",
  voice: "voices",
};

const MILESTONES = [
  {
    title: "The Red Dot Appears",
    subtitle: "The first time Shilpi saw the red dot.",
    description:
      "A doctor pointed at a tiny red dot on a screen and suddenly, the future became real.",
    image: "/scans/tiny-red-dot.png",
  },
  {
    title: "Heartbeat that Shifted Something in Me",
    subtitle: "151 beats per minute.",
    description: "We didn't understand the sound. But somehow, it mattered.",
    image: "/scans/heartbeat-shifted-something.png",
  },
  {
    title: "The Level 2 Scan",
    subtitle: "The first meeting.",
    description:
      "This was the day Red Dot stopped feeling abstract and became someone we were waiting to meet.",
    image: "/scans/level-2-scan.jpeg",
  },
  {
    title: "The Worry",
    subtitle: "The Doppler days.",
    description:
      "For a brief moment, we were concerned. We were stupid. The heartbeat stayed strong and growth remained healthy.",
    image: "/scans/doppler-days.png",
  },
  {
    title: "Mom Wrote a Letter to Red Dot",
    subtitle: "When the baby became her strength.",
    description:
      "I read the letter and it inspired me to create this experience and share with you all. Hope the love that surrounded the baby even before birth continues to grow.",
    image: "/scans/letters.png",
  },
];

export default function RedDotExperience() {
  const [guestName, setGuestName] = useState("");
  const [guestMessage, setGuestMessage] = useState("");
  const [memoryWall, setMemoryWall] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const imageRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const voiceRef = useRef<HTMLInputElement | null>(null);

  const [playingJourney, setPlayingJourney] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!playingJourney) return;
    const t = setInterval(() => {
      setCurrentSlide((s) => (s + 1) % MILESTONES.length);
    }, 3500);
    return () => clearInterval(t);
  }, [playingJourney]);

  const nextSlide = useCallback(
    () => setCurrentSlide((s) => (s + 1) % MILESTONES.length),
    []
  );
  const prevSlide = useCallback(
    () => setCurrentSlide((s) => (s - 1 + MILESTONES.length) % MILESTONES.length),
    []
  );

  useEffect(() => {
    if (!playingJourney) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === "Escape") setPlayingJourney(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [playingJourney, nextSlide, prevSlide]);

  const fetchMemories = useCallback(async () => {
    try {
      const response = await fetch("/api/memories");
      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Could not load memories.");
      }

      setMemoryWall(result.data as Memory[]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load memories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const memoryLoadTimer = window.setTimeout(() => {
      fetchMemories();
    }, 0);

    const channel = supabase
      .channel("memory-wall")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "memories",
        },
        (payload) => {
          setMemoryWall((prev) => [payload.new as Memory, ...prev]);
        }
      )
      .subscribe();

    return () => {
      window.clearTimeout(memoryLoadTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchMemories]);

  const addMemory = async (
    type: MemoryType,
    content: string,
    preview: string
  ) => {
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: guestName?.trim() || "Anonymous",
          content,
          preview,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Could not save memory.");
      }

      if (data.data && Array.isArray(data.data) && data.data[0]) {
        setMemoryWall((prev) => [data.data[0] as Memory, ...prev]);
      }

      setSuccess("Memory successfully added to the wall.");
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save memory.";
      setError(message);
      return false;
    }
  };

  const uploadMedia = async (
    file: File,
    type: Exclude<MemoryType, "text">
  ) => {
    try {
      setUploading(true);

      const extension = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()}.${extension}`;
      const bucket = BUCKETS[type];

      const { error } = await supabase.storage.from(bucket).upload(fileName, file);
      if (error) throw error;

      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      const saved = await addMemory(type, data.publicUrl, file.name);

      if (saved) {
        setGuestName("");
        setGuestMessage("");
      }
    } catch (err) {
      console.error(err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(185,28,28,0.28),transparent_34%),linear-gradient(to_bottom,#050000,#160202_46%,#050000)]" />

        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-7 md:grid-cols-2 md:gap-12">
          <div className="text-center md:text-left">
            <div className="mx-auto mb-6 h-7 w-7 rounded-full bg-red-600 shadow-[0_0_52px_rgba(220,38,38,0.85)] animate-pulse md:mx-0 md:mb-10 md:h-8 md:w-8" />

            <p className="mb-4 text-[10px] uppercase tracking-[0.34em] text-red-200 sm:text-xs md:mb-6 md:tracking-[0.5em]">
              RED DOT
            </p>

            <h1 className="mx-auto mb-5 max-w-[11ch] text-[clamp(2.55rem,13vw,4.25rem)] font-serif leading-[0.98] sm:max-w-none md:mx-0 md:mb-8 md:text-7xl">
              Before you meet our child,
              <br className="hidden sm:block" />
              enter the journey.
            </h1>

            <p className="mx-auto mb-7 max-w-sm text-base leading-relaxed text-zinc-300 md:mx-0 md:mb-12 md:max-w-xl md:text-xl">
              A cinematic memory experience by Shilpi & Keshav.
              <br className="hidden sm:block" />
              The story of a life that began as a tiny red dot.
            </p>

            <a
              href="#journey"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById("journey");
                el?.scrollIntoView({ behavior: "smooth" });
                setCurrentSlide(0);
                setPlayingJourney(true);
              }}
              className="inline-flex w-full items-center justify-center rounded-full bg-red-700 px-7 py-3.5 text-base shadow-2xl transition-all duration-300 hover:bg-red-600 sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
            >
              Begin Journey
            </a>
          </div>

          <div
            id="leave-memory"
            data-section="leave-memory"
            className="rounded-2xl border border-red-900/35 bg-white/[0.055] p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6 md:rounded-3xl md:p-8"
          >
            <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-red-300 sm:text-xs sm:tracking-[0.4em] md:mb-4">
                  A MESSAGE FOR RED DOT
                </p>
                <h2 className="text-3xl font-serif leading-tight md:text-4xl">
                  Leave a Memory
                </h2>
              </div>
              <a
                href="#memory-wall"
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById("memory-wall");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center justify-center rounded-full bg-red-900/45 px-4 py-2 text-[11px] uppercase tracking-wider text-red-200 transition-all hover:bg-red-900/60 sm:ml-4 sm:whitespace-nowrap"
              >
                Check Memories
              </a>
            </div>

            <div className="space-y-3.5 sm:space-y-4">
              {error ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100 sm:rounded-2xl">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 sm:rounded-2xl">
                  {success}
                </div>
              ) : null}

              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-red-900/40 bg-black/45 px-4 py-3 text-base outline-none transition focus:border-red-500 sm:rounded-2xl sm:px-5 sm:text-sm"
              />

              <textarea
                rows={4}
                value={guestMessage}
                onChange={(e) => setGuestMessage(e.target.value)}
                placeholder="Write something for Red Dot..."
                className="w-full resize-none rounded-xl border border-red-900/40 bg-black/45 px-4 py-3 text-base outline-none transition focus:border-red-500 sm:rounded-2xl sm:px-5 sm:text-sm"
              />

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => imageRef.current?.click()}
                  disabled={uploading}
                  className="rounded-xl border border-red-900/40 bg-black/45 px-2 py-3 text-[11px] transition hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
                >
                  Image
                </button>

                <button
                  type="button"
                  onClick={() => videoRef.current?.click()}
                  disabled={uploading}
                  className="rounded-xl border border-red-900/40 bg-black/45 px-2 py-3 text-[11px] transition hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
                >
                  Video
                </button>

                <button
                  type="button"
                  onClick={() => voiceRef.current?.click()}
                  disabled={uploading}
                  className="rounded-xl border border-red-900/40 bg-black/45 px-2 py-3 text-[11px] transition hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
                >
                  Voice
                </button>
              </div>

              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={imageRef}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await uploadMedia(file, "image");
                }}
              />

              <input
                type="file"
                accept="video/*"
                capture="environment"
                ref={videoRef}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await uploadMedia(file, "video");
                }}
              />

              <input
                type="file"
                accept="audio/*"
                capture
                ref={voiceRef}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await uploadMedia(file, "voice");
                }}
              />

              <button
                type="button"
                onClick={async () => {
                  if (!guestMessage.trim()) return;
                  setUploading(true);
                  const saved = await addMemory(
                    "text",
                    guestMessage,
                    guestMessage.slice(0, 80)
                  );
                  if (saved) {
                    setGuestName("");
                    setGuestMessage("");
                  }
                  setUploading(false);
                }}
                disabled={uploading}
                className="w-full rounded-xl bg-red-700 py-3.5 text-base font-medium transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Send to Red Dot"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        id="journey"
        className="relative bg-gradient-to-b from-black to-[#120303] px-4 py-20 sm:px-6 md:py-32"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center md:mb-24">
            <p className="mb-4 text-[10px] uppercase tracking-[0.28em] text-red-300 sm:text-xs sm:tracking-[0.4em] md:mb-6">
              THE JOURNEY OF RED DOT
            </p>

            <h2 className="mb-5 text-4xl font-serif leading-tight md:mb-8 md:text-6xl">
              Nine Months Inside Love
            </h2>

            <p className="mx-auto max-w-3xl text-base leading-relaxed text-zinc-400 md:text-lg">
              These scans were once medical reports.
              <br className="hidden sm:block" />
              Today, they are the first chapters of Red Dot&apos;s story.
            </p>
          </div>

          <div className="space-y-20 md:space-y-32">
            {MILESTONES.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 80 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: index * 0.08 }}
                viewport={{ once: true }}
                className={`grid items-center gap-7 md:grid-cols-2 md:gap-12 ${
                  index % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div className="group relative">
                  <div className="absolute inset-0 rounded-2xl bg-red-700/20 opacity-60 blur-3xl transition duration-700 group-hover:opacity-100 md:rounded-3xl" />

                  <img
                    src={item.image}
                    alt={item.title}
                    className="relative max-h-[72vh] w-full rounded-2xl border border-red-900/40 object-contain shadow-2xl md:max-h-[650px] md:rounded-3xl"
                    style={{ backgroundColor: "#040404" }}
                  />
                </div>

                <div>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-red-300 sm:text-xs sm:tracking-[0.4em] md:mb-5">
                    CHAPTER {index + 1}
                  </p>

                  <h3 className="mb-3 text-3xl font-serif leading-tight md:mb-4 md:text-5xl">
                    {item.title}
                  </h3>

                  <p className="mb-4 text-lg italic text-red-200 md:mb-6 md:text-xl">
                    {item.subtitle}
                  </p>

                  <p className="text-base leading-relaxed text-zinc-300 md:mb-8 md:text-lg">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {playingJourney && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/[0.92] px-3 py-3 sm:px-4 sm:py-4">
              <div className="relative mx-0 max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-auto md:mx-6 md:max-h-[calc(100vh-6rem)]">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9 }}
                  className="max-h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border border-red-900/30 bg-black/85 shadow-2xl md:max-h-none md:rounded-3xl"
                >
                  <div className="md:flex md:items-center">
                    <div className="flex w-full items-center justify-center bg-black p-3 md:w-1/2 md:p-6">
                      <img
                        src={MILESTONES[currentSlide].image}
                        alt={MILESTONES[currentSlide].title}
                        className="max-h-[34vh] w-full object-contain md:max-h-[60vh]"
                        style={{ backgroundColor: "#040404" }}
                      />
                    </div>

                    <div className="w-full p-4 md:w-1/2 md:p-6">
                      <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-red-300 md:text-xs md:tracking-[0.4em]">
                        CHAPTER {currentSlide + 1}
                      </p>

                      <h3 className="mb-3 text-2xl font-serif leading-tight md:text-4xl">
                        {MILESTONES[currentSlide].title}
                      </h3>

                      <p className="mb-3 text-sm italic text-red-200 md:text-base">
                        {MILESTONES[currentSlide].subtitle}
                      </p>

                      <p className="text-sm leading-relaxed text-zinc-300 md:text-base">
                        {MILESTONES[currentSlide].description}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <div className="mt-3 grid grid-cols-3 gap-2 px-1 sm:flex sm:flex-wrap sm:justify-end sm:gap-3 sm:px-4 md:px-0">
                  <button
                    onClick={() => prevSlide()}
                    className="rounded-full bg-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/15 sm:min-w-[84px] sm:rounded-md sm:py-2"
                  >
                    Back
                  </button>

                  <button
                    onClick={() => setPlayingJourney(false)}
                    className="rounded-full bg-red-700 px-4 py-2.5 text-sm text-white hover:bg-red-600 sm:min-w-[84px] sm:rounded-md sm:py-2"
                  >
                    Close
                  </button>

                  <button
                    onClick={() => nextSlide()}
                    className="rounded-full bg-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/15 sm:min-w-[84px] sm:rounded-md sm:py-2"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section
        id="memory-wall"
        className="bg-gradient-to-b from-[#120303] to-black px-4 py-20 sm:px-6 md:py-32"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <a
                href="#leave-memory"
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById("leave-memory");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center justify-center rounded-full bg-red-900/45 px-4 py-2 text-[11px] uppercase tracking-wider text-red-200 transition-all hover:bg-red-900/60 sm:mt-1 sm:whitespace-nowrap"
              >
                Share Your Wishes
              </a>
              <div>
                <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-red-300 sm:text-xs sm:tracking-[0.3em]">
                  LIVE MEMORY WALL
                </p>

                <h3 className="text-4xl font-serif leading-tight">
                  Wishes for Red Dot
                </h3>
              </div>
            </div>

            <div className="text-xs uppercase tracking-[0.26em] text-red-300 sm:text-sm sm:tracking-[0.3em]">
              {memoryWall.length} Memories
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-lg text-zinc-400">Loading memories...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 md:gap-6">
              {memoryWall.map((memory) => (
                <details
                  key={memory.id}
                  className="group overflow-hidden rounded-2xl border border-red-900/30 bg-white/[0.055] backdrop-blur-xl md:rounded-3xl"
                >
                  <summary className="cursor-pointer list-none p-4 transition hover:bg-white/5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mb-3 break-words text-xs uppercase tracking-[0.24em] text-red-200 sm:text-sm sm:tracking-[0.3em]">
                          {memory.name}
                        </p>

                        <p className="break-words text-sm leading-relaxed text-zinc-300 sm:text-base">
                          {memory.preview}
                        </p>
                      </div>

                      <div className="shrink-0 rounded-full border border-red-900/40 px-2.5 py-1 text-[10px] uppercase tracking-wider text-red-200">
                        {memory.type}
                      </div>
                    </div>
                  </summary>

                  <div className="border-t border-red-900/20 px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-6">
                    {memory.type === "text" && (
                      <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-zinc-200 sm:text-lg">
                        {memory.content}
                      </p>
                    )}

                    {memory.type === "image" && (
                      <img
                        src={memory.content}
                        alt="Memory"
                        className="max-h-[70vh] w-full rounded-xl object-contain sm:max-h-[400px] sm:rounded-2xl"
                        style={{ backgroundColor: "#040404" }}
                      />
                    )}

                    {memory.type === "video" && (
                      <video
                        controls
                        className="w-full rounded-xl sm:rounded-2xl"
                        src={memory.content}
                      />
                    )}

                    {memory.type === "voice" && memory.content && (
                      <audio controls className="w-full" src={memory.content} />
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-red-950 bg-black px-4 py-16 text-center sm:px-6 md:py-20">
        <div className="mx-auto mb-6 h-5 w-5 rounded-full bg-red-600 animate-pulse md:mb-8" />

        <h3 className="mb-5 text-3xl font-serif leading-tight md:mb-6 md:text-5xl">
          From Red Dot to Forever
        </h3>

        <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-zinc-400 md:mb-10 md:text-lg">
          Thank you for being part of this journey.
          <br className="hidden sm:block" />
          Your presence is now part of Red Dot&apos;s story.
        </p>

        <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-600 sm:text-xs sm:tracking-[0.4em]">
          Shilpi & Keshav | EDD : 22nd June 2026
        </div>
      </footer>
    </div>
  );
}
