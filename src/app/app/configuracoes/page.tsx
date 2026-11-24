"use client";

import { ClinicForm } from "@/components/clinic/clinic-form";
import { ReadOnlyNotice } from "@/components/feedback/read-only-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" description="Dados da clínica usados pelo agente e pelo painel." />
      <ReadOnlyNotice permission="clinic:write" />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Dados da clínica</CardTitle>
          <CardDescription>O agente usa estas informações para responder aos pacientes.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClinicForm />
        </CardContent>
      </Card>
    </>
  );
}
