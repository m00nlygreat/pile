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
        <div
          className="channel-modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="channel-modal-card"
            style={{
              background: "var(--panel-bg, #fff)",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "360px",
              width: "90%",
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.15)",
            }}
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
