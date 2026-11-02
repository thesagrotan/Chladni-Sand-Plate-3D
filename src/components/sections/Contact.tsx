interface ContactProps {
  dotColor: string;
}

export function Contact({ dotColor }: ContactProps) {
  return (
    <footer
      id="contact"
      className="px-8 sm:px-14 md:px-40 py-12 sm:py-14  mx-auto w-full"
    >
      <div className="flex flex-col">
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

        {/* Visit by Appointment */}
        <p
          data-text-repulsor
          className="mt-12 text-3xl font-serif leading-tight"
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

        <div
          className="mt-12 text-3xl font-mono flex items-center gap-3"
          style={{ color: dotColor, opacity: 0.55 }}
        >
          <span>© 2026 TEZETT – PLATTE</span>
          <span>·</span>
          <span>BERLIN</span>
        </div>
      </div>
    </footer>
  );
}
