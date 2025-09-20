import type { Metadata } from "next";
import { notFound } from "next/navigation";

/* eslint-disable @next/next/no-img-element */
import { MarkdownPreview } from "@/components/MarkdownPreview";
import type { BoardChannelContext } from "@/lib/board-data";
import { getBoardChannelContext } from "@/lib/board-data";

import PasteCapture from "./PasteCapture";

type PageParams = {
  boardId: string;
  channelId: string;
};

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
};

type SessionGroup = {
  key: string;
  label: string;
  sessionStart: Date | null;
  items: ItemViewModel[];
};

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const context = getBoardChannelContext(params.boardId, params.channelId);

  if (!context || !context.activeChannel) {
    return {
      title: "채널을 찾을 수 없음 | pile",
      description: "요청하신 보드 또는 채널이 존재하지 않습니다.",
    };
  }

  return {
    title: `${context.board.name} · ${context.activeChannel.name} | pile`,
    description:
      context.board.description ?? `${context.board.name} 보드의 ${context.activeChannel.name} 채널`,
  };
}

export default function BoardChannelPage({
  params,
}: {
  params: PageParams;
}) {
  const context = getBoardChannelContext(params.boardId, params.channelId);

  if (!context || !context.activeChannel) {
    notFound();
  }

  const sessionGroups = buildSessionGroups(context);

  return (
    <main className="board-shell">
      <header className="board-header">
        <div className="board-header-inner">
          <span className="board-slug">/{context.board.slug}</span>
          <h1>{context.board.name}</h1>
          {context.board.description ? (
            <p>{context.board.description}</p>
          ) : (
            <p className="board-description-muted">설명이 등록되지 않았습니다.</p>
          )}
        </div>
        <aside className="board-meta">
          <dl>
            <div>
              <dt>채널 수</dt>
              <dd>{context.channels.length}</dd>
            </div>
            <div>
              <dt>현재 채널</dt>
              <dd>{context.activeChannel.name}</dd>
            </div>
          </dl>
        </aside>
      </header>

      <nav className="channel-tabs" aria-label="채널 목록">
        {context.channels.map((channel) => (
          <a
            key={channel.id}
            href={`/${context.board.slug}/${channel.slug}`}
            className={`channel-tab${
              channel.id === context.activeChannel!.id ? " channel-tab-active" : ""
            }`}
          >
            {channel.name}
          </a>
        ))}
      </nav>

      <section className="channel-body" aria-live="polite">
        <header className="channel-heading">
          <div>
            <h2>{context.activeChannel.name}</h2>
            <p className="channel-helpers">
              붙여넣기나 드롭으로 텍스트·링크·파일을 추가하면 이 목록이 갱신됩니다.
            </p>
          </div>
          <p className="channel-count">
            총 {sessionGroups.reduce((acc, group) => acc + group.items.length, 0)}개 아이템
          </p>
        </header>

        <PasteCapture boardSlug={context.board.slug} channelId={context.activeChannel.id} />

        {sessionGroups.length === 0 ? (
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
                      <span className="item-author">{resolveAuthorName(item)}</span>
                      {item.createdAt ? (
                        <time dateTime={item.createdAt.toISOString()}>
                          {formatTimestamp(item.createdAt)}
                        </time>
                      ) : null}
                    </header>
                    {renderItemBody(item)}
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </section>
    </main>
  );
}

function buildSessionGroups(context: BoardChannelContext): SessionGroup[] {
  const buckets = new Map<string, SessionGroup>();

  for (const record of context.items) {
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
    };

    const key = viewModel.sessionStart
      ? viewModel.sessionStart.toISOString()
      : `no-session`;

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

    return (
      <div className="item-body">
        {item.linkUrl ? (
          <a href={item.linkUrl} target="_blank" rel="noreferrer">
            {linkLabel}
          </a>
        ) : (
          <span className="item-body-muted">링크 정보가 없습니다.</span>
        )}
        {hostname ? <span className="item-subtext">{hostname}</span> : null}
        {item.linkImage ? (
          <img src={item.linkImage} alt={linkLabel ?? "링크 이미지"} className="item-link-preview" />
        ) : null}
        {item.linkDesc ? <p className="item-subtext">{item.linkDesc}</p> : null}
      </div>
    );
  }

  const fileLabel = item.fileOriginalName ?? item.filePath?.split("/").at(-1) ?? "파일";
  const downloadPath = buildFileHref(item.filePath);

  return (
    <div className="item-body">
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

  return `${formatDate(date)} ${formatTime(date)} 세션`;
}

function formatTimestamp(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date): string {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
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
