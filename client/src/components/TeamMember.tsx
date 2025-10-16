import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TeamMemberProps {
  name: string;
  role: string;
  avatarUrl?: string;
}

export default function TeamMember({ name, role, avatarUrl }: TeamMemberProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{role}</p>
      </div>
    </div>
  );
}