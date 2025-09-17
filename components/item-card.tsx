/* eslint-disable @next/next/no-img-element */
import ReactMarkdown from 'react-markdown';

export type ItemWithRelations = {
  id: string;
  type: 'text' | 'link' | 'file';
  textMd?: string | null;
  filePath?: string | null;
  fileMime?: string | null;
  fileSize?: number | null;
  fileOriginalName?: string | null;
  linkUrl?: string | null;
  linkTitle?: string | null;
  linkDesc?: string | null;
  linkImage?: string | null;
  createdAt: number;
  sessionStart?: number | null;
  channel: {
    id: string;
    name: string;
    slug: string;
  };
  anonUser?: {
    id: string;
    nickname: string;
    displayName?: string | null;
  } | null;
};

type ItemCardProps = {
  item: ItemWithRelations;
  isAdmin: boolean;
  onDelete?: (id: string) => void;
};

function formatBytes(bytes?: number | null) {
  if (!bytes || Number.isNaN(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function ItemCard({ item, isAdmin, onDelete }: ItemCardProps) {
  const author = item.anonUser?.displayName || item.anonUser?.nickname || '익명';
  const created = new Date(item.createdAt * 1000).toLocaleString('ko-KR', {
    hour12: false
  });

  function fileHref() {
    if (!item.filePath) return '#';
    const segments = item.filePath.split('/').map(encodeURIComponent).join('/');
    return `/api/files/${segments}`;
  }

  return (
    <article className="item-card">
      <div className="meta">
        <span>#{item.channel.slug}</span>
        <span>{author}</span>
        <span>{created}</span>
        {item.type === 'file' && item.fileSize ? <span>{formatBytes(item.fileSize)}</span> : null}
      </div>
      <div>
        {item.type === 'text' && item.textMd ? (
          <ReactMarkdown>{item.textMd}</ReactMarkdown>
        ) : null}
        {item.type === 'link' && item.linkUrl ? (
          <div className="link-preview">
            <a href={item.linkUrl} target="_blank" rel="noreferrer">
              <strong>{item.linkTitle || item.linkUrl}</strong>
            </a>
            {item.linkDesc && <p>{item.linkDesc}</p>}
            {item.linkImage && (
              <img
                src={item.linkImage}
                alt={item.linkTitle ?? '링크 이미지'}
                style={{ maxWidth: '100%', borderRadius: '0.75rem', marginTop: '0.75rem' }}
              />
            )}
          </div>
        ) : null}
        {item.type === 'file' && item.filePath ? (
          <div className="file-preview">
            <a href={fileHref()} download>
              📁 {item.fileOriginalName || '파일 다운로드'}
            </a>
            <span style={{ color: 'rgba(15, 23, 42, 0.6)' }}>{item.fileMime}</span>
          </div>
        ) : null}
      </div>
      {isAdmin && onDelete ? (
        <div className="actions">
          <button type="button" onClick={() => onDelete(item.id)}>
            삭제
          </button>
        </div>
      ) : null}
    </article>
  );
}
