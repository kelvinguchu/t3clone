import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThreadsHistory } from "@/components/settings/history/threads-history";
import { SharedThreadsManager } from "@/components/settings/history/shared-threads-manager";

export default function Page() {
  return (
    <div className="space-y-4 sm:space-y-6 p-0 sm:p-6">
      <Tabs defaultValue="history" className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-purple-100 dark:bg-purple-900/20 border border-purple-200/60 dark:border-purple-800/50">
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-dark-bg-secondary data-[state=active]:text-purple-900 dark:data-[state=active]:text-purple-100 data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-800 text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100"
          >
            All Conversations
          </TabsTrigger>
          <TabsTrigger
            value="shared"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-dark-bg-secondary data-[state=active]:text-purple-900 dark:data-[state=active]:text-purple-100 data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-800 text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100"
          >
            Shared Links
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4 sm:space-y-6">
          <ThreadsHistory />
        </TabsContent>

        <TabsContent value="shared" className="space-y-4 sm:space-y-6">
          <SharedThreadsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
