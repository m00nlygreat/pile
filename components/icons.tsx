import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { s?: number };

function Icon({ d, s = 16, fill = "none", stroke = "currentColor", strokeWidth = 1.6, children, viewBox = "0 0 24 24", ...props }: IconProps & { d?: string }) {
  return (
    <svg
      width={s}
      height={s}
      viewBox={viewBox}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {d ? <path d={d} /> : children}
    </svg>
  );
}

export const I = {
  copy: (p: IconProps) => (
    <Icon {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </Icon>
  ),
  link: (p: IconProps) => <Icon {...p} d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />,
  file: (p: IconProps) => (
    <Icon {...p}>
      <path d="M14 3v5h5" />
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    </Icon>
  ),
  image: (p: IconProps) => (
    <Icon {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M21 16l-5-5L5 20" />
    </Icon>
  ),
  text: (p: IconProps) => <Icon {...p} d="M5 6h14M5 12h14M5 18h9" />,
  trash: (p: IconProps) => <Icon {...p} d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />,
  plus: (p: IconProps) => <Icon {...p} d="M12 5v14M5 12h14" />,
  check: (p: IconProps) => <Icon {...p} d="M5 12l5 5L20 6" />,
  clip: (p: IconProps) => (
    <Icon {...p}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
    </Icon>
  ),
  download: (p: IconProps) => <Icon {...p} d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />,
  play: (p: IconProps) => (
    <Icon {...p} fill="currentColor" stroke="none">
      <path d="M8 5v14l11-7z" />
    </Icon>
  ),
  user: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Icon>
  ),
  shield: (p: IconProps) => <Icon {...p} d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />,
  hash: (p: IconProps) => <Icon {...p} d="M6 9h14M5 15h14M10 4L8 20M16 4l-2 16" />,
  share: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4" />
    </Icon>
  ),
  pin: (p: IconProps) => <Icon {...p} d="M9 4h6l-1 6 3 3v2H7v-2l3-3z M12 15v5" />,
  poll: (p: IconProps) => (
    <Icon {...p}>
      <rect x="4" y="13" width="4" height="7" rx="1.5" />
      <rect x="10" y="8" width="4" height="12" rx="1.5" />
      <rect x="16" y="4" width="4" height="16" rx="1.5" />
    </Icon>
  ),
};
