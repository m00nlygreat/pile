import { notFound } from "next/navigation";

/* eslint-disable @next/next/no-img-element */
import { MarkdownPreview } from "@/components/MarkdownPreview";
import type { BoardChannelContext } from "@/lib/board-data";

import DeleteItemButton from "./[channelId]/DeleteItemButton";
import ChannelTabs from "./[channelId]/ChannelTabs";
import PasteCapture from "./[channelId]/PasteCapture";

type ItemViewModel = {
  id: string;
  type: "text" | "file" | "link";
  textMd: string | null;
  filePath: string | null;
  fileMime: string | null;
  fileSize: number | null;
  fileOriginalName: string | null;
  linkUrl: string | null;
  linkTitle: string | null;
  linkDesc: string | null;
  linkImage: string | null;
  createdAt: Date | null;
  sessionStart: Date | null;
  authorNickname: string | null;
  authorDisplayName: string | null;
  ownerAnonId: string | null;
  canDelete: boolean;
};

type SessionGroup = {
  key: string;
  label: string;
  sessionStart: Date | null;
  items: ItemViewModel[];
};

type BoardShellProps = {
  context: BoardChannelContext;
  viewerAnonId: string | null;
  viewerIsAdmin: boolean;
  allowPlaceholder: boolean;
};

export default function BoardShell({
  context,
  viewerAnonId,
  viewerIsAdmin,
  allowPlaceholder,
}: BoardShellProps) {
  const activeChannel = context.activeChannel;

  if (!context.boardExists && !allowPlaceholder) {
    notFound();
  }

  if (context.boardExists && !activeChannel) {
    notFound();
  }

  const sessionGroups = activeChannel
    ? buildSessionGroups(context, { viewerAnonId, viewerIsAdmin })
    : [];
  return (
    <main className="board-shell">
      <header className="board-header">
        <span className="board-path">/{context.board.slug}</span>
        <ChannelTabs
          boardSlug={context.board.slug}
          channels={context.channels}
          activeChannelId={activeChannel?.id ?? null}
          viewerIsAdmin={viewerIsAdmin}
          boardExists={context.boardExists}
          className="board-header-tabs"
        />
      </header>
      <PasteCapture boardSlug={context.board.slug} channelId={activeChannel?.id ?? null} />

      {!context.boardExists ? (
        <p className="channel-empty">아직 아무도 아이템을 붙여넣지 않았어요.</p>
      ) : sessionGroups.length === 0 ? (
        <p className="channel-empty">아직 등록된 아이템이 없습니다.</p>
      ) : (
        sessionGroups.map((group) => (
          <section key={group.key} className="session-block">
            <header className="session-header">
              <span className="session-pill">{group.label}</span>
            </header>
            <div className="session-items">
              {group.items.map((item) => (
                <article key={item.id} className={`item-card item-card-${item.type}`}>
                  <header className="item-meta">
                    <div className="item-meta-primary">
                      <span className="item-author">{resolveAuthorName(item)}</span>
                      {item.createdAt ? (
                        <time dateTime={item.createdAt.toISOString()}>{formatRelativeTime(item.createdAt)}</time>
                      ) : null}
                    </div>
                    {item.canDelete ? <DeleteItemButton itemId={item.id} /> : null}
                  </header>
                  {renderItemBody(item)}
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}

function buildSessionGroups(
  context: BoardChannelContext,
  viewer: { viewerAnonId: string | null; viewerIsAdmin: boolean },
): SessionGroup[] {
  const buckets = new Map<string, SessionGroup>();

  for (const record of context.items) {
    const ownerAnonId = record.item.anonUserId ?? null;
    const canDelete =
      viewer.viewerIsAdmin ||
      (viewer.viewerAnonId !== null && ownerAnonId !== null && viewer.viewerAnonId === ownerAnonId);

    const viewModel: ItemViewModel = {
      id: record.item.id,
      type: record.item.type,
      textMd: record.item.textMd ?? null,
      filePath: record.item.filePath ?? null,
      fileMime: record.item.fileMime ?? null,
      fileSize: record.item.fileSize ?? null,
      fileOriginalName: record.item.fileOriginalName ?? null,
      linkUrl: record.item.linkUrl ?? null,
      linkTitle: record.item.linkTitle ?? null,
      linkDesc: record.item.linkDesc ?? null,
      linkImage: record.item.linkImage ?? null,
      createdAt: record.item.createdAt ?? null,
      sessionStart: record.item.sessionStart ?? null,
      authorNickname: record.author?.nickname ?? null,
      authorDisplayName: record.author?.displayName ?? null,
      ownerAnonId,
      canDelete,
    };

    const key = viewModel.sessionStart ? viewModel.sessionStart.toISOString() : `no-session`;

    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: formatSessionLabel(viewModel.sessionStart),
        sessionStart: viewModel.sessionStart,
        items: [],
      });
    }

    buckets.get(key)!.items.push(viewModel);
  }

  const groups = Array.from(buckets.values());

  for (const group of groups) {
    group.items.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.getTime() : 0;
      const timeB = b.createdAt ? b.createdAt.getTime() : 0;
      return timeB - timeA;
    });
  }

  groups.sort((a, b) => {
    const aHasSession = Boolean(a.sessionStart);
    const bHasSession = Boolean(b.sessionStart);

    if (aHasSession && bHasSession) {
      return b.sessionStart!.getTime() - a.sessionStart!.getTime();
    }

    if (aHasSession) {
      return -1;
    }

    if (bHasSession) {
      return 1;
    }

    return 0;
  });

  return groups;
}

function resolveAuthorName(item: ItemViewModel): string {
  if (item.authorDisplayName && item.authorDisplayName.trim().length > 0) {
    return item.authorDisplayName;
  }

  if (item.authorNickname && item.authorNickname.trim().length > 0) {
    return item.authorNickname;
  }

  return "익명";
}

function renderItemBody(item: ItemViewModel) {
  if (item.type === "text") {
    return item.textMd ? (
      <MarkdownPreview content={item.textMd} className="item-body" />
    ) : (
      <p className="item-body item-body-muted">(내용이 비어 있습니다)</p>
    );
  }

  if (item.type === "link") {
    const linkLabel = item.linkTitle?.trim().length ? item.linkTitle : item.linkUrl;
    const hostname = item.linkUrl ? safeHostname(item.linkUrl) : null;
    const youtubeInfo = getYouTubeEmbedInfo(item.linkUrl);

    if (youtubeInfo) {
      return (
        <div className="item-body item-body-visual">
          <div className="item-visual-embed">
            <iframe
              src={`${youtubeInfo.embedUrl}?rel=0`}
              title={linkLabel ?? "YouTube 동영상"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      );
    }

    return (
      <div className="item-body item-body-visual">
        <div className="item-visual-row">
          {item.linkImage ? (
            <img src={item.linkImage} alt={linkLabel ?? "링크 이미지"} className="item-link-preview" />
          ) : null}
          <div className="item-visual-details">
            {item.linkUrl ? (
              <a href={item.linkUrl} target="_blank" rel="noreferrer" className="item-visual-title">
                {linkLabel}
              </a>
            ) : (
              <span className="item-body-muted">링크 정보가 없습니다.</span>
            )}
            {hostname ? <span className="item-subtext">{hostname}</span> : null}
            {item.linkDesc ? <p className="item-subtext">{item.linkDesc}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  const fileLabel = item.fileOriginalName ?? item.filePath?.split("/").at(-1) ?? "파일";
  const downloadPath = buildFileHref(item.filePath);

  return (
    <div className="item-body item-body-visual">
      {downloadPath ? (
        <a href={downloadPath} download={item.fileOriginalName ?? undefined}>
          {fileLabel}
        </a>
      ) : (
        <span className="item-body-muted">파일 경로가 없습니다.</span>
      )}
      {item.fileMime?.startsWith("image/") && downloadPath ? (
        <img src={downloadPath} alt={fileLabel} className="item-image-preview" />
      ) : null}
      <p className="item-subtext">
        {item.fileMime ?? "알 수 없는 형식"}
        {item.fileSize ? ` · ${formatFileSize(item.fileSize)}` : ""}
      </p>
    </div>
  );
}

function formatSessionLabel(date: Date | null): string {
  if (!date) {
    return "세션 미지정";
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();

  const hourLabel = `${hour}시`;
  const minuteLabel = minute > 0 ? ` ${minute}분` : "";

  return `${month}월 ${day}일 ${hourLabel}${minuteLabel}`;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs <= 0) {
    return "방금 전";
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return "방금 전";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}분 전`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}시간 전`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}일 전`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}개월 전`;
  }

  const years = Math.floor(months / 12);
  return `${years}년 전`;
}

function buildFileHref(filePath: string | null): string | null {
  if (!filePath) {
    return null;
  }

  const trimmed = filePath.replace(/^\/+/, "");
  const normalized = trimmed.replace(/^uploads\//, "");
  if (!normalized) {
    return null;
  }

  return `/api/uploads/${normalized}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function safeHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (error) {
    return null;
  }
}

function getYouTubeEmbedInfo(url: string | null): { embedUrl: string; videoId: string } | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").replace(/^m\./i, "");
    let videoId: string | null = null;

    if (host === "youtu.be") {
      videoId = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (host.endsWith("youtube.com")) {
      const path = parsed.pathname;
      if (path === "/watch") {
        videoId = parsed.searchParams.get("v");
      } else if (path.startsWith("/embed/")) {
        videoId = path.split("/")[2] ?? null;
      } else if (path.startsWith("/shorts/")) {
        videoId = path.split("/")[2] ?? null;
      }
    }

    if (!videoId) {
      return null;
    }

    const cleanedId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!cleanedId) {
      return null;
    }

    return {
      videoId: cleanedId,
      embedUrl: `https://www.youtube.com/embed/${cleanedId}`,
    };
  } catch (error) {
    return null;
  }
}
