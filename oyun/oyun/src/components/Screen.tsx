"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Band } from "./Ornament";
import { useI18n } from "@/lib/i18n";

/** Общая оболочка для отдельных экранов (профиль, создание, вход). */
export function Screen({ title, children, back = "/" }: { title: string; children: ReactNode; back?: string }) {
  const { t } = useI18n();
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-20">
      <div className="card fade-up w-full max-w-sm overflow-hidden">
        <Band />
        <div className="flex flex-col gap-4 p-6">
          <h1 className="text-center font-display text-2xl font-semibold">{title}</h1>
          {children}
          <Link href={back} className="btn-ghost btn-sm">{t("common.back")}</Link>
        </div>
      </div>
    </main>
  );
}
