export interface Release {
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

export const RELEASES: Release[] = [
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
    cover: '/assets/covers/tz-01.jpg',
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
