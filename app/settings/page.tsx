"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SourceTogglesForm } from "@/components/settings/source-toggles-form";
import { ApiKeysForm } from "@/components/settings/api-keys-form";
import { SenderProfileForm } from "@/components/settings/sender-profile-form";
import { ScheduleForm } from "@/components/settings/schedule-form";
import { AlertsForm } from "@/components/settings/alerts-form";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="apiKeys">API Keys</TabsTrigger>
          <TabsTrigger value="sender">Sender Profile</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>
        <TabsContent value="sources" className="mt-4">
          <SourceTogglesForm />
        </TabsContent>
        <TabsContent value="apiKeys" className="mt-4">
          <ApiKeysForm />
        </TabsContent>
        <TabsContent value="sender" className="mt-4">
          <SenderProfileForm />
        </TabsContent>
        <TabsContent value="schedule" className="mt-4">
          <ScheduleForm />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <AlertsForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
