"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

type ChannelNavItem = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
};

type BoardSidebarNavProps = {
  boardSlug: string;
  channels: ChannelNavItem[];
};

export function BoardSidebarNav({
  boardSlug,
  channels,
}: BoardSidebarNavProps) {
  const activeSegment = useSelectedLayoutSegment();

  return (
    <nav className="workspace-nav" aria-label="채널">
      <header className="workspace-nav-header">
        <h2>채널</h2>
        <p>총 {channels.length}개</p>
      </header>
      {channels.length === 0 ? (
        <p className="workspace-nav-empty">아직 채널이 없습니다.</p>
      ) : (
        <ul className="workspace-nav-list">
          {channels.map((channel) => {
            const isActive =
              activeSegment === channel.slug ||
              (!activeSegment && channel.isDefault);

            return (
              <li key={channel.id}>
                <Link
                  href={`/${boardSlug}/${channel.slug}`}
                  className="channel-link"
                  data-active={isActive ? "true" : "false"}
                >
                  <div className="channel-link-main">
                    <span aria-hidden className="channel-link-hash">
                      #
                    </span>
                    <span className="channel-link-name">{channel.name}</span>
                    {channel.isDefault ? (
                      <span className="channel-badge">기본</span>
                    ) : null}
                  </div>
                  <span className="channel-link-slug">
                    /{boardSlug}/{channel.slug}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
