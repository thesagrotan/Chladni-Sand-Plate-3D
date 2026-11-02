import { useState } from 'react';
import type { ColorTheme } from '../../utils/colorThemes.ts';
import { RELEASES } from '../../data/releases.ts';

interface HeroProps {
  dotColor: string;
  activeReleaseId: string | null;
  releaseThemes: Record<string, ColorTheme | undefined>;
  onPlayRelease: (releaseId: string) => void;
}

export function Hero({
  dotColor,
  activeReleaseId,
  releaseThemes,
  onPlayRelease,
}: HeroProps) {
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
    <section className="min-h-screen w-full flex flex-col justify-between px-2 sm:px-14 md:px-40 pb-8 sm:pb-12 select-none">
      {/* Main Title & Subtitle */}
      <div className="w-full mt-[20vh] flex flex-col items-start justify-center text-left">
        <p
          data-text-repulsor
          className="w-full max-w-none text-8xl font-serif mx leading-none tracking-tight font-normal text-left"
          style={{ color: dotColor }}
        >
          TEZETT PLATTE is a Berlin label and recording studio
        </p>
      </div>

      {/* Bottom: Releases Catalog */}
      <div className="w-full mx-auto flex flex-col pb-2 sm:pb-4 text-left page-text">
        <div data-text-repulsor className="page-text mb-6 sm:mb-7 text-left">
          Releases
        </div>

        <div className="flex flex-col gap-5 sm:gap-6 w-full page-text">
          {RELEASES.map((release) => {
            const isOpen = openId === release.id;
            const theme = releaseThemes[release.id];
            const canPlay = release.hasAudio || Boolean(theme);
            const isPlaying = activeReleaseId === release.id;
            return (
              <div key={release.id}>
                <div
                  onClick={() => handleToggleRelease(release.id)}
                  className="flex items-baseline w-full group cursor-pointer page-text"
                  title={isOpen ? 'Close release details' : 'Open release details'}
                >
                  <span data-text-repulsor className="page-text shrink-0 w-32 sm:w-40">
                    {release.catalog}
                  </span>
                  <span data-text-repulsor className="page-text">
                    {release.artist}
                  </span>
                  <span data-text-repulsor className="page-text italic ml-4">
                    {release.title}
                  </span>
                  {canPlay && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayRelease(release.id);
                      }}
                      data-text-repulsor
                      data-testid={`play-release-${release.id}`}
                      className="page-text underline underline-offset-8 cursor-pointer shrink-0 ml-auto pl-4"
                      title={
                        theme
                          ? `Play release and apply the ${theme.name} theme`
                          : 'Play / toggle Umbráfono sound'
                      }
                    >
                      {isPlaying ? '❚❚' : '▶'}
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
                    <div className="flex gap-5 sm:gap-8 items-start pl-32 sm:pl-40 pt-5 sm:pt-6 pr-1">
                      <img
                        src={release.cover}
                        alt={`${release.artist} — ${release.title} cover`}
                        {...(isOpen ? { 'data-text-repulsor': 'card' } : {})}
                        className="w-36 sm:w-44 aspect-square object-cover shrink-0"
                      />
                      <div className="flex flex-col page-text min-w-0">
                        <p {...(isOpen ? { 'data-text-repulsor': '' } : {})}>
                          {release.description}
                        </p>
                        <p
                          {...(isOpen ? { 'data-text-repulsor': '' } : {})}
                          className="mt-3"
                        >
                          {release.year} — {release.format}
                        </p>
                        {theme && (
                          <p
                            {...(isOpen ? { 'data-text-repulsor': '' } : {})}
                            className="mt-3"
                            data-testid={`release-theme-${release.id}`}
                          >
                            Plays with theme — {theme.name}
                          </p>
                        )}
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
