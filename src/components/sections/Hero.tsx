import { useState } from 'react';
import type { ChladniParams } from '../../types/chladni.ts';

interface Release {
  id: string;
  catalog: string;
  artist: string;
  title: string;
  year: string;
  format: string;
  discogsUrl: string;
  description: string;
  cover: string;
  hasAudio?: boolean;
}

const RELEASES: Release[] = [
  {
    id: 'tz-01',
    catalog: 'TZ-01',
    artist: 'Enrique del Castillo',
    title: 'Umbráfono (Sound Film Series)',
    year: '2023',
    format: '10″ / 35mm optical sound film',
    discogsUrl: 'https://www.discogs.com/search/?q=Enrique%20del%20Castillo%20Umbr%C3%A1fono',
    description:
      "Two pieces for optical sound film, recorded through the studio's stroboscopic 35mm rig. The projected strip is read as a score — dust, exposure and cut become the sound surface.",
    cover: '/assets/covers/tz-01.svg',
    hasAudio: true,
  },
  {
    id: 'tz-02',
    catalog: 'TZ-02',
    artist: 'Severine Beata',
    title: 'That Great Album',
    year: '2023',
    format: '12″ vinyl LP',
    discogsUrl: 'https://www.discogs.com/search/?q=Severine%20Beata%20That%20Great%20Album',
    description:
      'Recorded live to tape in the Kreuzberg studio. Eight pieces for prepared piano, tape loops and room resonance, mastered and cut for vinyl.',
    cover: '/assets/covers/tz-02.svg',
  },
];

interface HeroProps {
  params: ChladniParams;
  dotColor: string;
  onToggleAudio: () => void;
}

export function Hero({ params, dotColor, onToggleAudio }: HeroProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const handleToggleRelease = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));

    // Coalesce text-mask refreshes to a few easing-keyed steps instead of
    // one dispatch per rAF frame for 260ms. Each dispatch triggers the full
    // DOM-measure + blurred-canvas rasterize (TextMaskManager throttles it
    // to ~35fps internally), so the per-frame storm would pile up main-thread
    // work exactly while the panel is animating.
    const refresh = () => window.dispatchEvent(new CustomEvent('chladni:refresh-text-mask'));
    refresh();
    window.setTimeout(refresh, 80);
    window.setTimeout(refresh, 160);
  };

  return (
    <section className="min-h-screen w-full flex flex-col justify-between px-2 sm:px-14 md:px-40 py-8 sm:py-12 select-none">
      {/* Main Title & Subtitle */}
      <div className="w-full my-auto flex flex-col items-start justify-center text-left">
        <p
          data-text-repulsor
          className="w-full max-w-none text-8xl font-serif mx mt-4 sm:mt-5 leading-none tracking-tight font-normal text-left"
          style={{ color: dotColor }}
        >
          TEZETT PLATTE is a Berlin label and recording studio
        </p>
      </div>

      {/* Bottom: Releases Catalog */}
      <div
        className="w-full mx-auto flex flex-col pb-2 sm:pb-4 text-left font-serif text-3xl"
        style={{ color: dotColor }}
      >
        <div
          data-text-repulsor
          className="text-3xl font-serif font-normal mb-6 sm:mb-7 tracking-wide text-left"
        >
          Releases
        </div>

        <div className="flex flex-col gap-5 sm:gap-6 w-full text-3xl font-serif leading-tight font-normal">
          {RELEASES.map((release) => {
            const isOpen = openId === release.id;
            return (
              <div key={release.id}>
                <div
                  onClick={() => handleToggleRelease(release.id)}
                  className="flex items-baseline w-full group cursor-pointer text-3xl font-serif leading-tight"
                  title={isOpen ? 'Close release details' : 'Open release details'}
                >
                  <span data-text-repulsor className="text-3xl font-serif shrink-0 w-32 sm:w-44">
                    {release.catalog}
                  </span>
                  <span data-text-repulsor className="text-3xl font-serif">
                    {release.artist}
                  </span>
                  <span data-text-repulsor className="text-3xl font-serif italic ml-4">
                    {release.title}
                  </span>
                  {release.hasAudio && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleAudio();
                      }}
                      data-text-repulsor
                      className="text-3xl font-serif underline underline-offset-8 cursor-pointer shrink-0 ml-auto pl-4"
                      title="Play / toggle Umbráfono sound"
                    >
                      {params.audioEnabled ? '❚❚' : '▶'}
                    </button>
                  )}
                </div>

                <div
                  className="release-panel"
                  style={{
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <div className="overflow-hidden min-h-0">
                    <div className="flex gap-5 sm:gap-8 items-start pl-32 sm:pl-44 pt-5 sm:pt-6 pr-1">
                      <img
                        src={release.cover}
                        alt={`${release.artist} — ${release.title} cover`}
                        {...(isOpen ? { 'data-text-repulsor': 'card' } : {})}
                        className="w-36 sm:w-44 aspect-square object-cover shrink-0"
                      />
                      <div className="flex flex-col text-base sm:text-lg leading-relaxed font-normal min-w-0">
                        <p
                          {...(isOpen ? { 'data-text-repulsor': '' } : {})}
                          style={{ opacity: 0.88 }}
                        >
                          {release.description}
                        </p>
                        <p
                          {...(isOpen ? { 'data-text-repulsor': '' } : {})}
                          className="mt-3"
                        >
                          {release.year} — {release.format}
                        </p>
                        <a
                          href={release.discogsUrl}
                          target="_blank"
                          rel="noreferrer"
                          {...(isOpen ? { 'data-text-repulsor': '' } : {})}
                          className="underline underline-offset-4 mt-3 hover:opacity-70 transition-opacity duration-150"
                        >
                          View on Discogs ↗
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
