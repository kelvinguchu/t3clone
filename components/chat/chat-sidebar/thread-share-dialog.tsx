"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Share2,
  Copy,
  Eye,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  BarChart3,
  ShieldOff,
  Settings,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { UseThreadShareReturn } from "@/lib/actions/chat/chat-sidebar/thread-share-handler";

interface Props {
  shareHandler: UseThreadShareReturn;
  threadTitle: string;
}

const EXPIRATION_OPTIONS = [
  { value: "24", label: "24 hours" },
  { value: "168", label: "1 week" },
  { value: "720", label: "1 month" },
  { value: "2160", label: "3 months" },
];

export function ThreadShareDialog({
  shareHandler,
  threadTitle,
}: Readonly<Props>) {
  const { state, actions } = shareHandler;
  const [selectedExpiration, setSelectedExpiration] = useState<string>("24");
  const [localAllowCloning, setLocalAllowCloning] = useState(
    state.allowCloning,
  );
  const [copied, setCopied] = useState(false);
  const [showMakePrivateDialog, setShowMakePrivateDialog] = useState(false);

  const handleShare = async () => {
    const expiresInHours = parseInt(selectedExpiration);
    await actions.toggleShare({
      expiresInHours,
      allowCloning: localAllowCloning,
    });
  };

  const handleCopyUrl = async () => {
    await actions.copyShareUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloningToggle = async (enabled: boolean) => {
    setLocalAllowCloning(enabled);
    if (state.isPublic) {
      await actions.updateCloningSettings(enabled);
    }
  };

  const handleMakePrivate = async () => {
    await actions.toggleShare(); // This will make it private since it's currently public
    setShowMakePrivateDialog(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isExpired = Boolean(state.expiresAt && state.expiresAt < Date.now());

  return (
    <>
      <Dialog
        open={state.isDialogOpen}
        onOpenChange={() => actions.closeDialog()}
      >
        <DialogContent className="w-[95vw] z-60 max-w-md mx-auto h-[85vh] sm:h-[90vh] max-h-[85vh] sm:max-h-[90vh] bg-gradient-to-br from-purple-50 to-white dark:from-dark-bg-secondary dark:to-dark-bg-tertiary border-purple-200 dark:border-dark-purple-accent flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-1 sm:px-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg text-purple-800 dark:text-slate-200">
              <Share2 className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
              <span className="truncate">Share Conversation</span>
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base text-purple-600 dark:text-slate-400 line-clamp-2">
              {state.isPublic
                ? `Manage sharing settings for "${threadTitle}"`
                : `Create a shareable link for "${threadTitle}"`}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 overflow-auto">
            <div className="space-y-3 sm:space-y-4 pr-2 sm:pr-4">
              {/* Show share URL if already shared */}
              {state.isPublic && state.shareUrl && (
                <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 bg-purple-50 dark:bg-dark-bg-tertiary/50 rounded-lg border border-purple-200 dark:border-dark-purple-accent">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${isExpired ? "bg-red-500" : "bg-green-500 animate-pulse"}`}
                    ></div>
                    <Label className="text-xs sm:text-sm font-medium text-purple-800 dark:text-slate-200">
                      {isExpired ? "Share Link Expired" : "Share Link Active"}
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={state.shareUrl}
                        readOnly
                        className="font-mono text-xs bg-white dark:bg-dark-bg-secondary border-purple-300 dark:border-dark-purple-accent text-purple-700 dark:text-slate-300 min-w-0 flex-1"
                      />
                      <Button
                        onClick={handleCopyUrl}
                        size="sm"
                        variant="outline"
                        disabled={isExpired}
                        className={`shrink-0 h-9 w-9 sm:h-auto sm:w-auto sm:px-3 transition-all duration-200 cursor-pointer ${
                          copied
                            ? "bg-green-100 dark:bg-green-900/30 border-green-300 text-green-700 dark:text-green-300"
                            : "border-purple-300 dark:border-dark-purple-accent text-purple-700 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-dark-bg-secondary"
                        }`}
                      >
                        {copied ? (
                          <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                        ) : (
                          <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                        )}
                      </Button>
                    </div>
                    {copied && (
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Link copied to clipboard!
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Sharing Settings - show for both shared and unshared threads */}
              <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-purple-50 dark:bg-dark-bg-tertiary/50 rounded-lg border border-purple-200 dark:border-dark-purple-accent">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <Settings className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                  <Label className="text-xs sm:text-sm font-semibold text-purple-800 dark:text-slate-200">
                    {state.isPublic ? "Sharing Settings" : "Share Settings"}
                  </Label>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <Label className="text-xs sm:text-sm font-medium text-purple-800 dark:text-slate-200">
                        Allow Cloning
                      </Label>
                      <p className="text-xs text-purple-600 dark:text-slate-400 leading-relaxed">
                        Let others create their own copy of this conversation
                      </p>
                    </div>
                    <Switch
                      checked={localAllowCloning}
                      onCheckedChange={handleCloningToggle}
                      disabled={state.isSharing || isExpired}
                      className="data-[state=checked]:bg-purple-600 cursor-pointer shrink-0"
                    />
                  </div>
                </div>

                {!state.isPublic && (
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-medium text-purple-800 dark:text-slate-200">
                      Link Expiration
                    </Label>
                    <Select
                      value={selectedExpiration}
                      onValueChange={setSelectedExpiration}
                    >
                      <SelectTrigger className="bg-white dark:bg-dark-bg-secondary border-purple-300 dark:border-dark-purple-accent cursor-pointer h-9 sm:h-10">
                        <SelectValue placeholder="Select expiration time" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-dark-bg-secondary border-purple-200 dark:border-purple-800">
                        {EXPIRATION_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className="focus:bg-purple-50 dark:focus:bg-purple-900/20 cursor-pointer py-2 sm:py-2.5"
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Current Expiration (when public and has expiration) */}
              {state.isPublic && state.expiresAt && (
                <Alert
                  className={`${
                    isExpired
                      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/50"
                      : "bg-amber-50 dark:bg-dark-bg-tertiary/50 border-amber-200 dark:border-amber-500/50"
                  }`}
                >
                  <Clock
                    className={`h-3 w-3 sm:h-4 sm:w-4 ${isExpired ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}
                  />
                  <AlertDescription
                    className={`text-xs sm:text-sm ${
                      isExpired
                        ? "text-red-800 dark:text-red-200"
                        : "text-amber-800 dark:text-amber-200"
                    }`}
                  >
                    This share link {isExpired ? "expired" : "expires"} on{" "}
                    {formatDate(state.expiresAt)}
                  </AlertDescription>
                </Alert>
              )}

              {/* Statistics (when public) */}
              {state.isPublic && state.shareStats && (
                <div className="bg-white/70 dark:bg-dark-bg-tertiary/60 rounded-lg p-3 sm:p-4 border border-purple-200 dark:border-dark-purple-accent backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                    <Label className="text-xs sm:text-sm font-semibold text-purple-800 dark:text-slate-200">
                      Share Analytics
                    </Label>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
                    <div className="bg-purple-50 dark:bg-dark-bg-secondary/50 rounded-lg p-2 sm:p-3 text-center">
                      <div className="flex items-center justify-center gap-1 sm:gap-2 mb-1">
                        <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-lg sm:text-2xl font-bold text-purple-800 dark:text-slate-200">
                        {state.shareStats.viewCount}
                      </p>
                      <p className="text-xs font-medium text-purple-600 dark:text-slate-400">
                        Views
                      </p>
                    </div>

                    <div className="bg-purple-50 dark:bg-dark-bg-secondary/50 rounded-lg p-2 sm:p-3 text-center">
                      <div className="flex items-center justify-center gap-1 sm:gap-2 mb-1">
                        <Users className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-lg sm:text-2xl font-bold text-purple-800 dark:text-slate-200">
                        {state.shareStats.cloneCount}
                      </p>
                      <p className="text-xs font-medium text-purple-600 dark:text-slate-400">
                        Clones
                      </p>
                    </div>
                  </div>

                  {state.shareStats.lastViewed && (
                    <div className="pt-2 border-t border-purple-200 dark:border-dark-purple-accent">
                      <p className="text-xs text-purple-600 dark:text-slate-400 text-center">
                        Last viewed:{" "}
                        <span className="font-medium">
                          {formatDate(state.shareStats.lastViewed)}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {state.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <AlertDescription className="text-xs sm:text-sm">
                    {state.error}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>

          {/* Action Buttons - Fixed at bottom */}
          <div className="flex-shrink-0 border-t border-purple-200 dark:border-dark-purple-accent pt-3 sm:pt-4 mt-3 sm:mt-4 px-1 sm:px-0">
            <div className="flex gap-2">
              {state.isPublic ? (
                <>
                  <Button
                    onClick={() => setShowMakePrivateDialog(true)}
                    variant="destructive"
                    disabled={state.isSharing}
                    className="flex-1 cursor-pointer h-10 sm:h-auto text-xs sm:text-sm"
                  >
                    <ShieldOff className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">
                      {state.isSharing ? "Making Private..." : "Make Private"}
                    </span>
                    <span className="sm:hidden">
                      {state.isSharing ? "Making..." : "Private"}
                    </span>
                  </Button>
                  <Button
                    onClick={() => window.open(state.shareUrl ?? "", "_blank")}
                    variant="outline"
                    size="sm"
                    disabled={isExpired}
                    className="shrink-0 border-purple-300 dark:border-dark-purple-accent text-purple-700 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-dark-bg-secondary cursor-pointer h-10 w-10 sm:h-auto sm:w-auto sm:px-3"
                  >
                    <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleShare}
                  disabled={state.isSharing}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer h-10 sm:h-auto text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">
                    {state.isSharing ? "Creating Link..." : "Create Share Link"}
                  </span>
                  <span className="sm:hidden">
                    {state.isSharing ? "Creating..." : "Create Link"}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Make Private Confirmation Dialog */}
      <AlertDialog
        open={showMakePrivateDialog}
        onOpenChange={setShowMakePrivateDialog}
      >
        <AlertDialogContent className="w-[95vw] max-w-md mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Make Thread Private
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm leading-relaxed">
              Are you sure you want to make &ldquo;{threadTitle}&rdquo; private?
              This will revoke the share link and make the conversation
              inaccessible to anyone who previously had the link.
              <br />
              <br />
              <strong>This action cannot be undone.</strong> You can share the
              thread again later, but it will have a new share link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={state.isSharing}
              className="w-full sm:w-auto h-10 sm:h-auto text-xs sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMakePrivate}
              disabled={state.isSharing}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 cursor-pointer w-full sm:w-auto h-10 sm:h-auto text-xs sm:text-sm"
            >
              {state.isSharing ? "Making Private..." : "Make Private"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
