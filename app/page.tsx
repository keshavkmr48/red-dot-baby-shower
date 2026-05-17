"use client";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
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

export default function RedDotExperience() {
  const [guestName, setGuestName] = useState("");
  const [guestMessage, setGuestMessage] = useState("");
  const [memoryWall, setMemoryWall] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const imageRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const voiceRef = useRef<HTMLInputElement | null>(null);

  const journeyRef = useRef<HTMLElement | null>(null);
  const [playingJourney, setPlayingJourney] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const milestones = [
    {
      title: "The Red Dot Appears",
      subtitle: "The first time shilpi saw the red dot.",
      description:
        "A doctor pointed at a tiny red dot on a screen and suddenly, the future became real.",
      image:
        "/scans/tiny-red-dot.png",
    },
    {
      title: "Heartbeat that Shifted Something in me",
      subtitle: "151 beats per minute.",
      description:
        "We didn’t understand the sound. But somehow, It mattered.",
      image:
        "/scans/heartbeat-shifted-something.png",
    },
    {
      title: "The Level 2 Scan",
      subtitle: "The first meeting.",
      description:
        "This was the day Red Dot stopped feeling abstract and became someone we were waiting to meet.",
      image:
        "/scans/level-2-scan.jpeg",
    },
    {
      title: "The Worry",
      subtitle: "The Doppler days.",
      description:
        "For a brief moment, we were concerned. We were stupid. The heartbeat stayed strong and growth remained healthy.",
      image:
        "/scans/doppler-days.png",
    },
    {
      title: "Mom wrote a letter to Red Dot",
      subtitle: "When the baby became her strength.",
      description:
        "I read the letter and it inspired me to create this experience and share with you all. Hope the love that surrounded the baby even before birth continues to grow.",
      image:
        "/scans/letters.png",
    },
  ];

  useEffect(() => {
    if (!playingJourney) return;
    const t = setInterval(() => {
      setCurrentSlide((s) => (s + 1) % milestones.length);
    }, 3500);
    return () => clearInterval(t);
  }, [playingJourney]);

  const nextSlide = () => setCurrentSlide((s) => (s + 1) % milestones.length);
  const prevSlide = () => setCurrentSlide((s) => (s - 1 + milestones.length) % milestones.length);

  useEffect(() => {
    if (!playingJourney) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === "Escape") setPlayingJourney(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [playingJourney]);

  const fetchMemories = async () => {
    setLoading(true);

    const { data } = await supabase
      .from("memories")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setMemoryWall(data as Memory[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchMemories();

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
      supabase.removeChannel(channel);
    };
  }, []);

  const addMemory = async (
    type: MemoryType,
    content: string,
    preview: string
  ) => {
    const { error } = await supabase.from("memories").insert({
      type,
      name: guestName || "Anonymous",
      content,
      preview,
    });

    if (error) {
      setError("Could not save memory.");
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

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      await addMemory(type, data.publicUrl, file.name);
    } catch (err) {
      console.error(err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Hero */}
      <section className="relative h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#140000] to-black" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="w-8 h-8 rounded-full bg-red-600 mx-auto animate-pulse shadow-[0_0_60px_rgba(220,38,38,0.8)] mb-10" />

          <p className="uppercase tracking-[0.5em] text-red-200 text-xs mb-6">
            RED DOT
          </p>

          <h1 className="text-5xl md:text-8xl font-serif leading-tight mb-8">
            Before you meet our child,
            <br />
            enter the journey.
          </h1>

          <p className="text-lg md:text-2xl text-zinc-300 leading-relaxed max-w-3xl mx-auto mb-12">
            A cinematic memory experience by Shilpi & Keshav.
            <br />
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
            className="inline-flex items-center gap-3 bg-red-700 hover:bg-red-600 transition-all duration-300 px-8 py-4 rounded-full text-lg shadow-2xl"
          >
            Begin Journey
          </a>
        </div>
      </section>

      {/* Timeline Journey */}
      <section
        id="journey"
        className="relative py-32 px-6 bg-gradient-to-b from-black to-[#120303]"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-24">
            <p className="uppercase tracking-[0.4em] text-red-300 text-xs mb-6">
              THE JOURNEY OF RED DOT
            </p>

            <h2 className="text-4xl md:text-6xl font-serif mb-8">
              Nine Months Inside Love
            </h2>

            <p className="text-zinc-400 text-lg max-w-3xl mx-auto leading-relaxed">
              These scans were once medical reports.
              <br />
              Today, they are the first chapters of Red Dot’s story.
            </p>
          </div>

          <div className="space-y-32">
            {milestones.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 80 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 7, delay: index * 0.3 }}
                viewport={{ once: true }}
                className={`grid md:grid-cols-2 gap-12 items-center ${
                  index % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div className="relative group">
                  <div className="absolute inset-0 bg-red-700/20 blur-3xl rounded-3xl opacity-60 group-hover:opacity-100 transition duration-700" />

                  <img
                    src={item.image}
                    alt={item.title}
                    className="relative rounded-3xl border border-red-900/40 shadow-2xl object-contain max-h-[650px] w-full"
                    style={{ backgroundColor: '#040404' }}
                  />
                </div>

                <div>
                  <p className="uppercase tracking-[0.4em] text-red-300 text-xs mb-5">
                    CHAPTER {index + 1}
                  </p>

                  <h3 className="text-4xl md:text-5xl font-serif mb-4 leading-tight">
                    {item.title}
                  </h3>

                  <p className="text-red-200 text-xl italic mb-6">
                    {item.subtitle}
                  </p>

                  <p className="text-zinc-300 text-lg leading-relaxed mb-8">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Player overlay (auto-plays like frames) */}
          {playingJourney && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
              <div className="relative max-w-4xl w-full mx-0 md:mx-6 max-h-[calc(100vh-4rem)] overflow-hidden">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9 }}
                  className="rounded-3xl overflow-hidden bg-black/80 border border-red-900/30 shadow-2xl"
                >
                  <div className="md:flex md:items-center">
                    <div className="md:w-1/2 w-full bg-black flex items-center justify-center p-4 md:p-6">
                      <img
                        src={milestones[currentSlide].image}
                        alt={milestones[currentSlide].title}
                        className="w-full object-contain max-h-[55vh] md:max-h-[70vh]"
                        style={{ backgroundColor: '#040404' }}
                      />
                    </div>

                    <div className="md:w-1/2 w-full p-6 md:p-8">
                      <p className="uppercase tracking-[0.4em] text-red-300 text-xs mb-4">
                        CHAPTER {currentSlide + 1}
                      </p>

                      <h3 className="text-3xl md:text-4xl font-serif mb-4">
                        {milestones[currentSlide].title}
                      </h3>

                      <p className="text-red-200 italic mb-4">
                        {milestones[currentSlide].subtitle}
                      </p>

                      <p className="text-zinc-300 leading-relaxed">
                        {milestones[currentSlide].description}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <div className="mt-4 flex flex-wrap justify-end gap-3 px-4 md:px-0">
                  <button
                    onClick={() => prevSlide()}
                    className="min-w-[84px] px-4 py-2 bg-white/6 hover:bg-white/10 rounded-md text-white text-sm"
                  >
                    Back
                  </button>

                  <button
                    onClick={() => setPlayingJourney(false)}
                    className="min-w-[84px] px-4 py-2 bg-red-700 hover:bg-red-600 rounded-md text-white text-sm"
                  >
                    Close
                  </button>

                  <button
                    onClick={() => nextSlide()}
                    className="min-w-[84px] px-4 py-2 bg-white/6 hover:bg-white/10 rounded-md text-white text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Guest Wishes */}
      <section className="py-32 px-6 bg-gradient-to-b from-[#120303] to-black">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <p className="uppercase tracking-[0.4em] text-red-300 text-xs mb-6">
            A MESSAGE FOR RED DOT
          </p>

          <h2 className="text-5xl md:text-6xl font-serif mb-8">
            Leave a Memory
          </h2>

          <p className="text-zinc-300 text-lg leading-relaxed">
            Every blessing instantly becomes part of Red Dot’s living memory wall.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 max-w-7xl mx-auto items-start">
          {/* Submission Form */}
          <div className="bg-white/5 border border-red-900/30 rounded-3xl p-8 backdrop-blur-xl sticky top-10">
            <div className="space-y-6">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-black/40 border border-red-900/40 rounded-2xl px-5 py-4 outline-none focus:border-red-500"
              />

              <textarea
                rows={6}
                value={guestMessage}
                onChange={(e) => setGuestMessage(e.target.value)}
                placeholder="Write something for Red Dot..."
                className="w-full bg-black/40 border border-red-900/40 rounded-2xl px-5 py-4 outline-none focus:border-red-500"
              />

              <div className="grid grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => imageRef.current?.click()}
                  className="bg-black/40 border border-red-900/40 rounded-2xl py-4 hover:border-red-500 transition"
                >
                  📷 Image
                </button>

                <button
                  type="button"
                  onClick={() => videoRef.current?.click()}
                  className="bg-black/40 border border-red-900/40 rounded-2xl py-4 hover:border-red-500 transition"
                >
                  🎥 Video
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.mediaDevices) {
                      voiceRef.current?.click();
                      return;
                    }

                    voiceRef.current?.click();
                  }}
                  className="bg-black/40 border border-red-900/40 rounded-2xl py-4 hover:border-red-500 transition"
                >
                  🎤 Voice
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

                  await addMemory(
                    "text",
                    guestMessage,
                    guestMessage.slice(0, 80)
                  );

                  setGuestMessage("");
                }}
                className="w-full bg-red-700 hover:bg-red-600 transition py-4 rounded-2xl text-lg font-medium"
              >{uploading ? "Uploading..." : "Send to Red Dot"}</button>
            </div>
          </div>

          {/* Memory Wall */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="uppercase tracking-[0.3em] text-red-300 text-xs mb-3">
                  LIVE MEMORY WALL
                </p>

                <h3 className="text-4xl font-serif">
                  Wishes for Red Dot
                </h3>
              </div>

              <div className="text-red-300 text-sm uppercase tracking-[0.3em]">
                {memoryWall.length} Memories
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-200">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-zinc-400 text-lg">Loading memories...</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
              {memoryWall.map((memory) => (
                <details
                  key={memory.id}
                  className="group bg-white/5 border border-red-900/30 rounded-3xl overflow-hidden backdrop-blur-xl"
                >
                  <summary className="cursor-pointer list-none p-6 hover:bg-white/5 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-red-200 text-sm uppercase tracking-[0.3em] mb-3">
                          {memory.name}
                        </p>

                        <p className="text-zinc-300 leading-relaxed">
                          {memory.preview}
                        </p>
                      </div>

                      <div className="text-2xl">
                        {memory.type === "text" && "💌"}
                        {memory.type === "image" && "📷"}
                        {memory.type === "video" && "🎥"}
                        {memory.type === "voice" && "🎤"}
                      </div>
                    </div>
                  </summary>

                  <div className="px-6 pb-6 border-t border-red-900/20 pt-6">
                    {memory.type === "text" && (
                      <p className="text-zinc-200 leading-relaxed text-lg whitespace-pre-wrap">
                        {memory.content}
                      </p>
                    )}

                    {memory.type === "image" && (
                      <img
                        src={memory.content}
                        alt="Memory"
                        className="rounded-2xl w-full object-contain max-h-[400px]"
                        style={{ backgroundColor: '#040404' }}
                      />
                    )}

                    {memory.type === "video" && (
                      <video
                        controls
                        className="rounded-2xl w-full"
                        src={memory.content}
                      />
                    )}

                    {memory.type === "voice" && memory.content && (
                      <audio
                        controls
                        className="w-full"
                        src={memory.content}
                      />
                    )}
                  </div>
                </details>
              ))}
            </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-red-950 text-center bg-black">
        <div className="w-5 h-5 rounded-full bg-red-600 mx-auto mb-8 animate-pulse" />

        <h3 className="text-3xl md:text-5xl font-serif mb-6">
          From Red Dot to Forever
        </h3>

        <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed text-lg mb-10">
          Thank you for being part of this journey.
          <br />
          Your presence is now part of Red Dot’s story.
        </p>

        <div className="text-zinc-600 uppercase tracking-[0.4em] text-xs">
          Shilpi & Keshav • EDD : 22nd June 2026
        </div>
      </footer>
    </div>
  );
}
