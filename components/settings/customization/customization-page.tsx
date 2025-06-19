"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Plus,
  Sparkles,
  User,
  Briefcase,
  Heart,
  MessageSquare,
} from "lucide-react";

interface CustomizationPreferences {
  userName: string;
  userRole: string;
  traits: string[];
  additionalInfo: string;
}

export function CustomizationPage() {
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [preferences, setPreferences] = useState<CustomizationPreferences>({
    userName: "",
    userRole: "",
    traits: [],
    additionalInfo: "",
  });
  const [newTrait, setNewTrait] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Convex queries and mutations
  const userPreferences = useQuery(
    api.userPreferences.getCustomizationPreferences,
    user ? { userId: user.id } : "skip",
  );

  const updatePreferences = useMutation(
    api.userPreferences.updateCustomizationPreferences,
  );

  const systemPrompt = useQuery(
    api.userPreferences.generateSystemPrompt,
    user ? { userId: user.id } : "skip",
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load preferences from database
  useEffect(() => {
    if (userPreferences) {
      setPreferences(userPreferences);
    }
  }, [userPreferences]);

  const validateField = (field: string, value: string | string[]) => {
    const newErrors = { ...errors };

    switch (field) {
      case "userName":
        if (typeof value === "string" && value.length > 50) {
          newErrors.userName = "Name must be 50 characters or less";
        } else {
          delete newErrors.userName;
        }
        break;
      case "userRole":
        if (typeof value === "string" && value.length > 100) {
          newErrors.userRole = "Role must be 100 characters or less";
        } else {
          delete newErrors.userRole;
        }
        break;
      case "traits":
        if (Array.isArray(value)) {
          if (value.length > 50) {
            newErrors.traits = "Maximum 50 traits allowed";
          } else {
            delete newErrors.traits;
          }
        }
        break;
      case "newTrait":
        if (typeof value === "string" && value.length > 100) {
          newErrors.newTrait = "Trait must be 100 characters or less";
        } else {
          delete newErrors.newTrait;
        }
        break;
    }

    setErrors(newErrors);
  };

  const handleInputChange = (
    field: keyof CustomizationPreferences,
    value: string,
  ) => {
    setPreferences((prev) => ({ ...prev, [field]: value }));
    validateField(field, value);
  };

  const addTrait = () => {
    const trimmedTrait = newTrait.trim();
    if (!trimmedTrait) return;

    if (preferences.traits.length >= 50) {
      setErrors((prev) => ({ ...prev, traits: "Maximum 50 traits allowed" }));
      return;
    }

    if (trimmedTrait.length > 100) {
      setErrors((prev) => ({
        ...prev,
        newTrait: "Trait must be 100 characters or less",
      }));
      return;
    }

    if (preferences.traits.includes(trimmedTrait)) {
      setErrors((prev) => ({ ...prev, newTrait: "This trait already exists" }));
      return;
    }

    const newTraits = [...preferences.traits, trimmedTrait];
    setPreferences((prev) => ({ ...prev, traits: newTraits }));
    setNewTrait("");
    validateField("traits", newTraits);

    // Clear newTrait error
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.newTrait;
      return newErrors;
    });
  };

  const removeTrait = (index: number) => {
    const newTraits = preferences.traits.filter((_, i) => i !== index);
    setPreferences((prev) => ({ ...prev, traits: newTraits }));
    validateField("traits", newTraits);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      addTrait();
    }
  };

  const handleSave = async () => {
    if (!user || Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      await updatePreferences({
        userId: user.id,
        userName: preferences.userName || undefined,
        userRole: preferences.userRole || undefined,
        traits: preferences.traits.length > 0 ? preferences.traits : undefined,
        additionalInfo: preferences.additionalInfo || undefined,
      });
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = () => {
    if (!userPreferences) return false;
    return (
      preferences.userName !== userPreferences.userName ||
      preferences.userRole !== userPreferences.userRole ||
      JSON.stringify(preferences.traits) !==
        JSON.stringify(userPreferences.traits) ||
      preferences.additionalInfo !== userPreferences.additionalInfo
    );
  };

  if (!mounted || !user) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Preview System Prompt */}
        {systemPrompt && (
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                Generated System Prompt
              </h3>
            </div>
            <p className="text-sm text-purple-800 dark:text-purple-200 bg-white dark:bg-dark-bg-secondary rounded-lg p-3 font-mono">
              {systemPrompt}
            </p>
          </div>
        )}

        {/* Name Field */}
        <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-4 sm:p-6 border border-purple-200/60 dark:border-purple-800/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                What should the assistant call you?
              </h3>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                Enter your name
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Input
              value={preferences.userName}
              onChange={(e) => handleInputChange("userName", e.target.value)}
              placeholder="Your name"
              maxLength={50}
              className="bg-purple-50 dark:bg-dark-bg-tertiary border-purple-200 dark:border-purple-800 focus:border-purple-500 dark:focus:border-purple-400"
            />
            <div className="flex justify-between items-center text-xs">
              <span
                className={
                  errors.userName
                    ? "text-red-500"
                    : "text-purple-600 dark:text-purple-400"
                }
              >
                {errors.userName || `${preferences.userName.length}/50`}
              </span>
            </div>
          </div>
        </div>

        {/* Role Field */}
        <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-4 sm:p-6 border border-purple-200/60 dark:border-purple-800/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                What do you do?
              </h3>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                Engineer, student, etc.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Input
              value={preferences.userRole}
              onChange={(e) => handleInputChange("userRole", e.target.value)}
              placeholder="Your role or profession"
              maxLength={100}
              className="bg-purple-50 dark:bg-dark-bg-tertiary border-purple-200 dark:border-purple-800 focus:border-purple-500 dark:focus:border-purple-400"
            />
            <div className="flex justify-between items-center text-xs">
              <span
                className={
                  errors.userRole
                    ? "text-red-500"
                    : "text-purple-600 dark:text-purple-400"
                }
              >
                {errors.userRole || `${preferences.userRole.length}/100`}
              </span>
            </div>
          </div>
        </div>

        {/* Traits Field */}
        <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-4 sm:p-6 border border-purple-200/60 dark:border-purple-800/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                What traits should the assistant have?
              </h3>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                (up to 50, max 100 chars each)
              </p>
            </div>
          </div>

          {/* Add Trait Input */}
          <div className="space-y-2 mb-4">
            <div className="flex gap-2">
              <Input
                value={newTrait}
                onChange={(e) => {
                  setNewTrait(e.target.value);
                  validateField("newTrait", e.target.value);
                }}
                onKeyDown={handleKeyPress}
                placeholder="Type a trait and press Enter or Tab..."
                maxLength={100}
                className="flex-1 bg-purple-50 dark:bg-dark-bg-tertiary border-purple-200 dark:border-purple-800 focus:border-purple-500 dark:focus:border-purple-400"
              />
              <Button
                onClick={addTrait}
                disabled={!newTrait.trim() || preferences.traits.length >= 50}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span
                className={
                  errors.newTrait
                    ? "text-red-500"
                    : "text-purple-600 dark:text-purple-400"
                }
              >
                {errors.newTrait || `${newTrait.length}/100`}
              </span>
              <span
                className={
                  errors.traits
                    ? "text-red-500"
                    : "text-purple-600 dark:text-purple-400"
                }
              >
                {errors.traits || `${preferences.traits.length}/50`}
              </span>
            </div>
          </div>

          {/* Traits List */}
          {preferences.traits.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {preferences.traits.map((trait, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 px-3 py-1 flex items-center gap-2"
                  >
                    <span className="text-sm">{trait}</span>
                    <button
                      onClick={() => removeTrait(index)}
                      className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Additional Info Field */}
        <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-4 sm:p-6 border border-purple-200/60 dark:border-purple-800/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                Anything else the assistant should know about you?
              </h3>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                Interests, values, or preferences to keep in mind
              </p>
            </div>
          </div>
          <Textarea
            value={preferences.additionalInfo}
            onChange={(e) =>
              handleInputChange("additionalInfo", e.target.value)
            }
            placeholder="Additional context about yourself..."
            rows={4}
            className="bg-purple-50 dark:bg-dark-bg-tertiary border-purple-200 dark:border-purple-800 focus:border-purple-500 dark:focus:border-purple-400 resize-none"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={
              isSaving || Object.keys(errors).length > 0 || !hasChanges()
            }
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2"
          >
            {isSaving ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </div>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
    </div>
  );
}
