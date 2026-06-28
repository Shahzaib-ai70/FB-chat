import { useMemo, useRef, useState } from "react";
import { ImagePlus, SendHorizonal, Smile, Sparkles, X } from "lucide-react";

interface MessageComposerProps {
  placeholder: string;
  disabled?: boolean;
  quickReplies?: string[];
  onSend: (payload: { text?: string; mediaUrl?: string; mediaType?: "image" }) => void;
  onTyping: (isTyping: boolean) => void;
}

const emojiOptions = ["😀", "😍", "🔥", "👍", "🙏", "🎉", "❤️", "😂"];

export function MessageComposer({
  placeholder,
  disabled,
  quickReplies = [],
  onSend,
  onTyping,
}: MessageComposerProps) {
  const [value, setValue] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canSend = useMemo(
    () => (value.trim().length > 0 || Boolean(mediaUrl)) && !disabled,
    [disabled, mediaUrl, value],
  );

  function submitMessage(message: string, nextMediaUrl = mediaUrl) {
    const trimmed = message.trim();
    if ((!trimmed && !nextMediaUrl) || disabled) {
      return;
    }

    onSend({
      text: trimmed,
      mediaUrl: nextMediaUrl ?? undefined,
      mediaType: nextMediaUrl ? "image" : undefined,
    });
    setValue("");
    setMediaUrl(null);
    onTyping(false);
  }

  return (
    <div className="composer-panel">
      {quickReplies.length > 0 ? (
        <div className="quick-replies" aria-label="Suggested replies">
          {quickReplies.map((reply) => (
            <button
              className="quick-reply"
              disabled={disabled}
              key={reply}
              onClick={() => submitMessage(reply, null)}
              type="button"
            >
              <Sparkles size={14} />
              <span>{reply}</span>
            </button>
          ))}
        </div>
      ) : null}
      {mediaUrl ? (
        <div className="media-preview-card">
          <img alt="Selected media preview" className="media-preview-image" src={mediaUrl} />
          <button
            className="media-remove-button"
            onClick={() => setMediaUrl(null)}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
      <div className="composer-row">
        <div className="composer-shell">
          <textarea
            aria-label="Message input"
            className="composer-input"
            disabled={disabled}
            onChange={(event) => {
              const nextValue = event.target.value;
              setValue(nextValue);
              onTyping(nextValue.trim().length > 0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitMessage(value);
              }
            }}
            placeholder={placeholder}
            rows={1}
            value={value}
          />
          <div className="composer-actions">
            <input
              accept="image/*"
              className="hidden-file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                  const result = typeof reader.result === "string" ? reader.result : null;
                  if (result) {
                    setMediaUrl(result);
                  }
                };
                reader.readAsDataURL(file);
                event.target.value = "";
              }}
              ref={fileInputRef}
              type="file"
            />
            <button
              className="icon-action-button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <ImagePlus size={18} />
            </button>
            <div className="emoji-menu-wrap">
              <button
                className="icon-action-button"
                disabled={disabled}
                onClick={() => setShowEmojiPicker((current) => !current)}
                type="button"
              >
                <Smile size={18} />
              </button>
              {showEmojiPicker ? (
                <div className="emoji-menu" aria-label="Emoji shortcuts">
                  {emojiOptions.map((emoji) => (
                    <button
                      className="emoji-menu-button"
                      disabled={disabled}
                      key={emoji}
                      onClick={() => {
                        const nextValue = `${value}${emoji}`;
                        setValue(nextValue);
                        onTyping(nextValue.trim().length > 0);
                        setShowEmojiPicker(false);
                      }}
                      type="button"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              aria-label="Send message"
              className="send-button compact"
              disabled={!canSend}
              onClick={() => submitMessage(value)}
              type="button"
            >
              <SendHorizonal size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
