import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getErrorMessage } from "@/lib/utils";

type FaqItem = {
  _id: Id<"faqItems">;
  _creationTime: number;
  question: string;
  answer: string;
  order: number;
  isPublished: boolean;
};

const EMPTY_FORM = { question: "", answer: "", isPublished: false };

/**
 * Admin page for managing public FAQ items.
 * Supports create, edit, delete, publish/unpublish, and up/down reordering.
 *
 * @returns The AdminFAQ page component.
 */
export default function AdminFAQ() {
  const faqItems = useQuery(api.admin.getAllFaqItems);
  const createFaqItem = useMutation(api.admin.createFaqItem);
  const updateFaqItem = useMutation(api.admin.updateFaqItem);
  const deleteFaqItem = useMutation(api.admin.deleteFaqItem);
  const reorderFaqItems = useMutation(api.admin.reorderFaqItems);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FaqItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FaqItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openCreate = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item: FaqItem) => {
    setEditingItem(item);
    setForm({
      question: item.question,
      answer: item.answer,
      isPublished: item.isPublished,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const question = form.question.trim();
    const answer = form.answer.trim();
    if (!question) {
      toast.error("Question is required");
      return;
    }
    if (!answer) {
      toast.error("Answer is required");
      return;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        await updateFaqItem({
          id: editingItem._id,
          question,
          answer,
          isPublished: form.isPublished,
        });
        toast.success("FAQ item updated");
      } else {
        await createFaqItem({
          question,
          answer,
          isPublished: form.isPublished,
        });
        toast.success("FAQ item created");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save FAQ item"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (item: FaqItem) => {
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteFaqItem({ id: deleteTarget._id });
      toast.success("FAQ item deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete FAQ item"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePublished = async (item: FaqItem) => {
    try {
      await updateFaqItem({ id: item._id, isPublished: !item.isPublished });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update FAQ item"));
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (!faqItems) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= faqItems.length) return;
    const newOrder = [...faqItems];
    [newOrder[index], newOrder[swapIndex]] = [
      newOrder[swapIndex],
      newOrder[index],
    ];
    try {
      await reorderFaqItems({ orderedIds: newOrder.map((i) => i._id) });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to reorder FAQ items"));
    }
  };

  if (faqItems === undefined) {
    return (
      <AdminLayout title="FAQ Management" subtitle="Manage Public FAQ Items">
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="FAQ Management" subtitle="Manage Public FAQ Items">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex justify-end">
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New FAQ Item
          </Button>
        </div>

        {faqItems.length === 0 ? (
          <Card className="border-2">
            <div className="text-center py-16 space-y-4">
              <HelpCircle className="h-10 w-10 text-muted-foreground/20 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-black uppercase text-muted-foreground">
                  No FAQ items yet.
                </p>
                <p className="text-xs text-muted-foreground">
                  Create your first FAQ item using the button above.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="border-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Order</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faqItems.map((item, index) => (
                  <TableRow key={item._id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <button
                          disabled={index === 0}
                          onClick={() => void handleMove(index, "up")}
                          className="disabled:opacity-30 hover:text-primary"
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          disabled={index === faqItems.length - 1}
                          onClick={() => void handleMove(index, "down")}
                          className="disabled:opacity-30 hover:text-primary"
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{item.question}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {item.answer}
                      </p>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => void handleTogglePublished(item)}>
                        <Badge
                          variant={item.isPublished ? "default" : "outline"}
                          className="cursor-pointer text-[10px] font-black uppercase"
                        >
                          {item.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDelete(item)}
                          aria-label="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit FAQ Item" : "New FAQ Item"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update the question, answer, and publish status."
                : "Add a new question and answer to the public FAQ page."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="faq-question">Question</Label>
              <Input
                id="faq-question"
                value={form.question}
                onChange={(e) =>
                  setForm((f) => ({ ...f, question: e.target.value }))
                }
                placeholder="How do I register to bid?"
                maxLength={300}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="faq-answer">Answer</Label>
              <Textarea
                id="faq-answer"
                value={form.answer}
                onChange={(e) =>
                  setForm((f) => ({ ...f, answer: e.target.value }))
                }
                placeholder="Create a free account, then complete KYC verification..."
                className="min-h-[120px] resize-none"
                maxLength={2000}
              />
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="faq-published"
                checked={form.isPublished}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isPublished: Boolean(checked) }))
                }
              />
              <Label htmlFor="faq-published" className="cursor-pointer">
                Published (visible on /faq)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAQ Item?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.question}&rdquo; will be permanently
              removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
