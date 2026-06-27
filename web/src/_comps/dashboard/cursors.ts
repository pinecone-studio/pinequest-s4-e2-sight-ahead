function quill(shaft: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'>` +
    `<line x1='5' y1='35' x2='24' y2='12' stroke='${shaft}' stroke-width='3' stroke-linecap='round'/>` +
    `<ellipse cx='27' cy='11' rx='5.5' ry='12' transform='rotate(42 27 11)' fill='#B86830' stroke='#F2ECD4' stroke-width='1'/>` +
    `<line x1='24' y1='12' x2='31' y2='6' stroke='#F2ECD4' stroke-width='1'/>` +
    `<circle cx='5' cy='35' r='2' fill='${shaft}'/>` +
    `</svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 5 35, auto`;
}

export const QUILL_LIGHT = quill("#EDE7CF");
export const QUILL_DARK = quill("#1B2420");

// Харандаа cursor — тэмдэглэлийн (цаасан) хэсэгт ашиглана.
function pencil(): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>` +
    `<g transform='rotate(45 16 16)'>` +
    `<rect x='12' y='2' width='8' height='4' rx='1.5' fill='#F2A0A0'/>` + // баллуур
    `<rect x='12' y='5.5' width='8' height='2.5' fill='#D9D2C4'/>` + // металл хүзүү
    `<rect x='12' y='7.5' width='8' height='13.5' fill='#F6C945'/>` + // мод бие
    `<polygon points='12,21 20,21 16,29' fill='#E2B981'/>` + // иртэй мод
    `<polygon points='14.3,25.6 17.7,25.6 16,29' fill='#333333'/>` + // бал
    `</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 6 26, auto`;
}

export const PENCIL = pencil();
