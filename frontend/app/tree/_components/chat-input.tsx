import { MessageSquare } from 'lucide-react';

export const ChatInput = ({
  value,
  onChange,
  onSubmit,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
}) => (
  <div className="shrink-0 px-8 pb-6 pt-2">
    <div className="flex items-center gap-3 rounded-full border border-neutral-600 bg-neutral-800 px-4 py-2.5">
      <MessageSquare size={20} className="shrink-0 text-blue-400" />
      <div className="h-5 w-px bg-neutral-600" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSubmit();
        }}
        placeholder="したいことはありますか？"
        className="flex-1 bg-transparent text-sm text-neutral-200 placeholder-neutral-500 outline-none"
      />
    </div>
  </div>
);
