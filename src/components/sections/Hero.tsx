import type { ChladniParams } from '../../types/chladni.ts';

interface HeroProps {
  params: ChladniParams;
  dotColor: string;
  onToggleAudio: () => void;
  onReleaseClick: (message: string) => void;
}

export function Hero({ params, dotColor, onToggleAudio, onReleaseClick }: HeroProps) {
  return (
    <section className="h-screen min-h-[680px] w-full flex flex-col justify-between px-2 sm:px-14 md:px-40 py-8 sm:py-12 select-none">
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
          {/* Row 1: Umbrafono Sound Film Series */}
          <div
            onClick={onToggleAudio}
            className="flex items-start w-full group cursor-pointer text-3xl font-serif leading-tight"
            title="Click to play / toggle Umbráfono sound"
          >
            <span data-text-repulsor className="text-3xl font-serif shrink-0 w-32 sm:w-44">TZ-01</span>
            <div className="flex flex-col text-3xl font-serif leading-tight flex-1">
              <div className="flex items-baseline justify-between w-full">
                <span data-text-repulsor className="text-3xl font-serif">Enrique del Castillo</span>
                <span
                  data-text-repulsor
                  className="text-3xl font-serif italic underline underline-offset-8 cursor-pointer shrink-0 ml-4"
                >
                  {params.audioEnabled ? '[Playing]' : '[Play]'}
                </span>
              </div>
              <span data-text-repulsor className="text-3xl font-serif italic">Umbráfono (Sound Film Series)</span>
              <span data-text-repulsor className="text-3xl font-serif">10″ / 35mm — 2023</span>
            </div>
          </div>

          {/* Row 2: Severine Beata That Great Album */}
          <div
            onClick={() => onReleaseClick('TZ-02: Severine Beata — That Great Album (12″ Vinyl LP)')}
            className="flex items-start w-full group cursor-pointer text-3xl font-serif leading-tight"
            title="TZ-02: Severine Beata — That Great Album"
          >
            <span data-text-repulsor className="text-3xl font-serif shrink-0 w-32 sm:w-44">TZ-02</span>
            <div className="flex flex-col text-3xl font-serif leading-tight">
              <span data-text-repulsor className="text-3xl font-serif">Severine Beata</span>
              <span data-text-repulsor className="text-3xl font-serif italic">That Great Album</span>
              <span data-text-repulsor className="text-3xl font-serif">12″ LP — 2023</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
