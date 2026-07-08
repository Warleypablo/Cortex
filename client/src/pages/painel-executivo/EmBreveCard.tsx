import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

export function EmBreveCard({ titulo, motivo }: { titulo: string; motivo: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-gray-400 dark:text-zinc-500">
          <Clock className="h-4 w-4" />
          <span className="text-xs font-medium">{titulo}</span>
        </div>
        <div className="mt-2 text-sm text-gray-400 dark:text-zinc-500">Em breve</div>
        <div className="mt-1 text-[11px] text-gray-400 dark:text-zinc-600">{motivo}</div>
      </CardContent>
    </Card>
  );
}
