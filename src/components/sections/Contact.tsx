interface ContactProps {
  dotColor: string;
}

export function Contact({ dotColor }: ContactProps) {
  return (
    <footer id="contact" className="px-8 sm:px-14 md:px-20 py-28 sm:py-36  mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <div
            data-text-repulsor
            className="text-3xl font-sans uppercase tracking-wider mb-2"
            style={{ color: dotColor, opacity: 0.75 }}
          >
            Contact
          </div>
          <p
            data-text-repulsor
            className="text-3xl sm:text-3xl font-serif font-normal"
            style={{ color: dotColor }}
          >
            contact@tezett-platte.berlin
          </p>
          <p
            data-text-repulsor
            className="text-3xl font-sans mt-4"
            style={{ color: dotColor, opacity: 0.75 }}
          >
            Klanglabor Berlin · Kreuzberg
          </p>
        </div>

        {/* Visit by Appointment */}
        <div>
          <div
            data-text-repulsor
            className="text-3xl font-sans uppercase tracking-wider mb-2"
            style={{ color: dotColor, opacity: 0.75 }}
          >
            Visit
          </div>
          <p
            data-text-repulsor
            className="text-3xl font-serif leading-tight"
            style={{ color: dotColor, opacity: 0.88 }}
          >
            Köpenicker Straße · Hinterhof
            <br />
            10999 Berlin · Kreuzberg
          </p>
          <p
            data-text-repulsor
            className="mt-4 font-mono text-sm"
            style={{ color: dotColor, opacity: 0.5 }}
          >
            Sessions and listening visits by prior arrangement only.
            <br />
            residencies@tezett-platte.berlin
          </p>
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <div
              data-text-repulsor
              className="text-3xl font-sans uppercase tracking-wider mb-2"
              style={{ color: dotColor, opacity: 0.75 }}
            >
              Physical Studio
            </div>
            <p
              data-text-repulsor
              className="text-3xl font-sans leading-tight"
              style={{ color: dotColor, opacity: 0.8 }}
            >
              Recording, mixing, and mastering for independent artists and labels. Acoustic research
              apparatus, analog tape, and resonance plates available for sessions by arrangement.
            </p>
          </div>

          <div
            className="mt-8 text-3xl font-mono flex items-center gap-3"
            style={{ color: dotColor, opacity: 0.55 }}
          >
            <span>© 2026 TEZETT – PLATTE</span>
            <span>·</span>
            <span>BERLIN</span>
          </div>
        </div>
      </div>
    </footer>
  );
}