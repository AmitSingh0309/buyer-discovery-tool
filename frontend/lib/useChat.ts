"use client";
import { useCallback } from "react";
import {
  fetchStatus,
  fetchLeads,
  startPipeline,
  startFinder,
  pipelineStreamUrl,
  finderStreamUrl,
} from "./api";
import { parseCommand } from "./commands";
import { useChatStore } from "./store";
import type { PipelineOptions, FinderOptions, PipelineResult, FinderResult, MessagePayload } from "./types";

export function useChat() {
  const store = useChatStore();

  const handleCommand = useCallback(
    async (raw: string) => {
      const cmd = parseCommand(raw);
      store.addUserMessage(raw);
      store.setLoading(true);

      try {
        switch (cmd.type) {
          case "HELP": {
            store.addAssistantMessage({ type: "help" });
            break;
          }

          case "CLEAR": {
            store.clearMessages();
            break;
          }

          case "STATUS": {
            const status = await fetchStatus();
            store.addAssistantMessage({ type: "status_panel", status });
            break;
          }

          case "CONFIG": {
            store.addAssistantMessage({ type: "config_panel" });
            break;
          }

          case "SHOW_LEADS": {
            const { leads, total } = await fetchLeads({
              limit: (cmd.args.limit as number) || 500,
            });
            if (leads.length === 0) {
              store.addAssistantMessage({
                type: "text",
                text: "No qualified leads found. Run the pipeline first, or check that `data/` has CSV files.",
              });
            } else {
              store.addAssistantMessage({ type: "leads_table", leads });
              store.addSystemMessage(`Showing ${leads.length} of ${total} qualified leads.`);
            }
            break;
          }

          case "INGEST": {
            store.addAssistantMessage({
              type: "ingest_batch",
              text: "Upload a buyer file to begin batch ingest.",
            });
            break;
          }

          case "FIND_BUYERS": {
            const options: Partial<FinderOptions> = {
              provider: (cmd.args.provider as FinderOptions["provider"]) || "cascade",
              limit_cities: (cmd.args.limit_cities as number) || null,
            };
            const { job_id } = await startFinder(options);
            let finderMsgId: string;
            const onFinderComplete = (result: FinderResult) => {
              store.updateMessage(finderMsgId, { result });
            };
            finderMsgId = store.addAssistantMessage({
              type: "finder_progress",
              jobId: job_id,
              finderStreamUrl: finderStreamUrl(job_id),
              onComplete: onFinderComplete as MessagePayload["onComplete"],
            });
            break;
          }

          case "RUN_PIPELINE": {
            const options: Partial<PipelineOptions> = {
              provider: (cmd.args.provider as PipelineOptions["provider"]) || "mock",
              limit: (cmd.args.limit as number) || 200,
              no_scrape: Boolean(cmd.args.no_scrape),
              no_discover: Boolean(cmd.args.no_discover),
            };
            const { job_id } = await startPipeline(options);
            let pipelineMsgId: string;
            const onPipelineComplete = async (result: PipelineResult) => {
              store.updateMessage(pipelineMsgId, { result });
              const { leads } = await fetchLeads({ limit: 500 });
              store.addAssistantMessage({ type: "leads_table", leads });
            };
            pipelineMsgId = store.addAssistantMessage({
              type: "pipeline_progress",
              jobId: job_id,
              streamUrl: pipelineStreamUrl(job_id),
              onComplete: onPipelineComplete as MessagePayload["onComplete"],
            });
            break;
          }

          default: {
            store.addAssistantMessage({
              type: "text",
              text: `Unknown command: "${raw}". Type **help** to see available commands.`,
            });
          }
        }
      } catch (err) {
        store.addAssistantMessage({
          type: "error",
          text: err instanceof Error ? err.message : "An unexpected error occurred.",
        });
      } finally {
        store.setLoading(false);
      }
    },
    [store]
  );

  return { handleCommand, ...store };
}