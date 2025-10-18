// components/TwoColumnLayout.tsx
import React from "react";

type Props = {
  left: React.ReactNode;
  right?: React.ReactNode;
};

export default function TwoColumnLayout({ left, right }: Props) {
  return (
    <div className="py-8 px-4 lg:px-0">
      <div className="ms-two-col">
        <main className="space-y-6">
          {left}
        </main>

        <aside className="space-y-6">
          {right}
        </aside>
      </div>
    </div>
  );
}
