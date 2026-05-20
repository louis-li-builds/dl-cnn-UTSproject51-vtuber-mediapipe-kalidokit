import { User, Star } from 'lucide-react';
import { AVATAR_CATALOG } from '../../pipeline/avatars.js';

interface AvatarSelectorProps {
  selectedAvatarId: string;
  onSelectAvatar: (id: string) => void;
}

export function AvatarSelector({
  selectedAvatarId,
  onSelectAvatar,
}: AvatarSelectorProps) {
  return (
    <div className="h-full flex flex-col bg-zinc-900 border-r border-zinc-700">
      <div className="p-4 border-b border-zinc-700">
        <h2 className="flex items-center gap-2 text-zinc-100">
          <User className="w-5 h-5" />
          Avatars
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {AVATAR_CATALOG.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              onClick={() => onSelectAvatar(avatar.id)}
              className={`w-full p-3 rounded-lg flex items-center gap-3 transition-colors ${
                selectedAvatarId === avatar.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <span className="text-2xl">{avatar.thumbnail}</span>
              <div className="flex-1 text-left">
                <div className="text-sm truncate">{avatar.name}</div>
              </div>
              {avatar.id === '1' && (
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
