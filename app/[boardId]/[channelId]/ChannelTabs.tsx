"use client";

import { useState } from "react";

import CreateChannelForm from "./CreateChannelForm";

type ChannelInfo = {
  id: string;
  name: string;
  slug: string;
};

export default function ChannelTabs({
  boardSlug,
  channels,
  activeChannelId,
  viewerIsAdmin,
  boardExists,
  className,
}: {
  boardSlug: string;
  channels: ChannelInfo[];
  activeChannelId?: string | null;
  viewerIsAdmin: boolean;
  boardExists: boolean;
  className?: string;
}) {
  const [showModal, setShowModal] = useState(false);

  const navClassName = ["channel-tabs", className].filter(Boolean).join(" ");

  return (
    <>
      <nav className={navClassName} aria-label="채널 목록">
        {channels.length === 0 ? (
          <span className="channel-tab channel-tab-empty" aria-disabled="true">
            채널이 아직 없습니다.
          </span>
        ) : (
          channels.map((channel) => (
            <a
              key={channel.id}
              href={`/${boardSlug}/${channel.slug}`}
              className={`channel-tab${channel.id === activeChannelId ? " channel-tab-active" : ""}`}
            >
              {channel.name}
            </a>
          ))
        )}
        {viewerIsAdmin && boardExists ? (
          <button
            type="button"
            className="channel-tab channel-tab-add"
            onClick={() => setShowModal(true)}
          >
            + 새 채널
          </button>
        ) : null}
      </nav>

      {viewerIsAdmin && boardExists && showModal ? (
        <div className="channel-modal-backdrop" onClick={() => setShowModal(false)}>
          <div
            className="channel-modal-card"
            role="dialog"
            aria-label="새 채널 추가"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <CreateChannelForm
              boardSlug={boardSlug}
              className="panel"
              onSuccess={() => setShowModal(false)}
              onCancel={() => setShowModal(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
