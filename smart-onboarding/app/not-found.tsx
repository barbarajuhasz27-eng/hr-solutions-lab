import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <Card>
      <EmptyState
        icon={<Compass />}
        title="Page not found"
        description="The page you are looking for doesn't exist in this workspace."
        action={<ButtonLink href="/">Go to dashboard</ButtonLink>}
      />
    </Card>
  );
}
