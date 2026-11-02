interface FacilityProps {
  dotColor: string;
}

const FACILITY_COLUMNS = [
  {
    title: 'Acoustic & Resonance',
    items: [
      'Custom stainless steel Chladni resonance plates (300 – 1200 mm)',
      'Electrodynamic transducers, 10 Hz – 18 kHz sweep',
      'Stroboscopic optical film projection rig (35mm dual-optical reader)',
      'Anechoic measurement chamber for nodal field mapping',
    ],
  },
  {
    title: 'Recording & Analog Chain',
    items: [
      'Studer A80 ¼″ 2-track master tape',
      'Telefunken V72 / Siemens tube preamplifiers',
      'Coles 4038 ribbon & Neumann KM84 microphones',
      'Pro Tools HDX + Neve 8078 console for hybrid sessions',
    ],
  },
];

export function Facility({ dotColor }: FacilityProps) {
  return (
    <section id="facility" className="px-2 sm:px-14 md:px-40 py-6 sm:py-8 w-full">
      <div data-text-repulsor className="text-3xl font-sans font-normal mb-10 tracking-wide">
        Facility
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {FACILITY_COLUMNS.map((column) => (
          <div key={column.title}>
            <div
              data-text-repulsor
              className="font-mono text-xs uppercase tracking-widest mb-4"
              style={{ color: dotColor, opacity: 0.5 }}
            >
              {column.title}
            </div>
            <ul className="flex flex-col gap-3">
              {column.items.map((item) => (
                <li
                  key={item}
                  data-text-repulsor
                  className="font-serif text-2xl leading-tight"
                  style={{ color: dotColor, opacity: 0.82 }}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
