interface ContactProps {
  dotColor: string;
}

export function Contact({ dotColor }: ContactProps) {
  return (
    <footer
      id="contact"
      className="px-8 sm:px-14 md:px-40 pt-6 sm:pt-8 pb-8 sm:pb-10 mx-auto w-full"
    >
      <div className="flex flex-col">
        <div data-text-repulsor className="page-text mb-2" style={{ color: dotColor }}>
          Contact
        </div>
        <p data-text-repulsor className="page-text break-words" style={{ color: dotColor }}>
          contact@tezett-platte.berlin
        </p>
        <p data-text-repulsor className="page-text mt-4" style={{ color: dotColor }}>
          Klanglabor Berlin · Kreuzberg
        </p>

        {/* Visit by Appointment */}
        <p data-text-repulsor className="page-text mt-12" style={{ color: dotColor }}>
          Köpenicker Straße · Hinterhof
          <br />
          10999 Berlin · Kreuzberg
        </p>
        <p data-text-repulsor className="page-text mt-4 break-words" style={{ color: dotColor }}>
          Sessions and listening visits by prior arrangement only.
          <br />
          residencies@tezett-platte.berlin
        </p>

        <div
          className="page-text mt-12 flex flex-wrap items-center gap-3"
          style={{ color: dotColor }}
        >
          <span>© 2026 TEZETT – PLATTE</span>
          <span>·</span>
          <span>BERLIN</span>
        </div>
      </div>
    </footer>
  );
}
