import { useId } from 'react';

const EMAIL = 'contact@tezett-platte.berlin';

export function Contact() {
  // Unique per instance so the inline SVG mask can never collide with another
  // box if the section is ever rendered twice.
  const maskId = `email-box-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <footer
      id="contact"
      className="px-8 sm:px-14 md:px-40 pt-4 sm:pt-6 pb-6 sm:pb-8 mx-auto w-full"
    >
      <div className="flex flex-col">
        <a href={`mailto:${EMAIL}`} className="email-box mt-2">
          {/* White box silhouette for the sand mask. */}
          <span
            data-text-repulsor="rect"
            aria-hidden="true"
            className="email-box__shape"
          />

          {/* The visible box: a white rectangle with the email punched out, so
              the WebGL plate and its grains show through the letterforms. */}
          <svg aria-hidden="true" focusable="false" className="email-box__cutout">
            <defs>
              <mask
                id={maskId}
                maskUnits="userSpaceOnUse"
                x="0"
                y="0"
                width="100%"
                height="100%"
              >
                <rect width="100%" height="100%" fill="white" />
                <text
                  className="page-text email-box__text"
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="black"
                >
                  {EMAIL}
                </text>
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="white"
              mask={`url(#${maskId})`}
            />
          </svg>

          {/* Transparent source text: it sizes the box, stays accessible, and
              is measured by the text-mask system as the glyph-shaped hole. */}
          <span
            data-text-repulsor="hole"
            className="page-text email-box__text email-box__label"
          >
            {EMAIL}
          </span>
        </a>

        <p data-text-repulsor className="page-text mt-12">
          Köpenicker Straße · Hinterhof
          <br />
          10999 Berlin · Kreuzberg
        </p>
        <p data-text-repulsor className="page-text mt-4 break-words">
          Sessions and listening visits by prior arrangement only.
        </p>

        <div className="page-text mt-12 flex flex-wrap items-center gap-3">
          <span>© 2026 TEZETT – PLATTE</span>
          <span>·</span>
          <span>BERLIN</span>
        </div>
      </div>
    </footer>
  );
}
