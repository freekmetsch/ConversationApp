import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { ConversationType } from "@shared/schema";

export function ConversationTypeManager() {
  const [conversationTypes, setConversationTypes] = useState<ConversationType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [typeName, setTypeName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const { toast } = useToast();

  // Load conversation types
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const response = await fetch('/api/conversation-types');
        if (response.ok) {
          const data = await response.json();
          setConversationTypes(data);
        } else {
          console.error("Failed to fetch conversation types:", response.statusText);
          toast({
            title: "Failed to load conversation types",
            description: `Error: ${response.statusText}`,
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Error fetching conversation types:", error);
        toast({
          title: "Network error",
          description: "Could not connect to the server. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTypes();
  }, [toast]);

  // Handle opening the create dialog
  const handleCreateClick = () => {
    setDialogMode('create');
    setTypeName("");
    setEditingTypeId(null);
    setDialogOpen(true);
  };

  // Handle opening the edit dialog
  const handleEditClick = (type: ConversationType) => {
    setDialogMode('edit');
    setTypeName(type.name);
    setEditingTypeId(type.id);
    setDialogOpen(true);
  };

  // Handle form submission (create or edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (dialogMode === 'create') {
        // Create new conversation type
        const response = await apiRequest(
          "POST",
          "/api/conversation-types",
          { name: typeName }
        );

        if (response.ok) {
          const newType = await response.json();
          setConversationTypes(prev => [...prev, newType]);
          toast({
            title: "Success",
            description: `Conversation type "${typeName}" created successfully.`
          });
          setDialogOpen(false);
        } else {
          const error = await response.json();
          throw new Error(error.error || response.statusText);
        }
      } else {
        // Edit existing conversation type
        if (!editingTypeId) return;

        const response = await apiRequest(
          "PUT",
          `/api/conversation-types/${editingTypeId}`,
          { name: typeName }
        );

        if (response.ok) {
          const updatedType = await response.json();
          setConversationTypes(prev => 
            prev.map(type => type.id === editingTypeId ? updatedType : type)
          );
          toast({
            title: "Success",
            description: `Conversation type updated successfully.`
          });
          setDialogOpen(false);
        } else {
          const error = await response.json();
          throw new Error(error.error || response.statusText);
        }
      }

      // Invalidate related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/conversation-types'] });
      
    } catch (error) {
      console.error("Error saving conversation type:", error);
      toast({
        title: "Failed to save",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete confirmation
  const handleConfirmDelete = async (id: number) => {
    try {
      const response = await apiRequest(
        "DELETE",
        `/api/conversation-types/${id}`,
        {}
      );

      if (response.ok) {
        setConversationTypes(prev => prev.filter(type => type.id !== id));
        toast({
          title: "Deleted",
          description: "Conversation type deleted successfully."
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || response.statusText);
      }

      // Invalidate related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/conversation-types'] });
      
    } catch (error) {
      console.error("Error deleting conversation type:", error);
      toast({
        title: "Failed to delete",
        description: error instanceof Error 
          ? error.message 
          : "Unknown error occurred. The type may be in use by existing conversations.",
        variant: "destructive"
      });
    } finally {
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium">Conversation Types</h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleCreateClick}
          className="flex items-center"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Type
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-gray-500">Loading conversation types...</div>
      ) : conversationTypes.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          <p>No conversation types found.</p>
          <p className="mt-2 text-sm">Create a type to categorize your coaching conversations.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {conversationTypes.map(type => (
            <Card key={type.id} className="relative group">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{type.name}</CardTitle>
                <CardDescription>
                  Created: {new Date(type.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-end pt-2">
                <div className="flex space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleEditClick(type)}
                    className="text-gray-500 hover:text-primary"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDeleteId(type.id)}
                    className="text-gray-500 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>

              {/* Delete confirmation overlay */}
              {confirmDeleteId === type.id && (
                <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center p-4 rounded-lg">
                  <p className="font-medium mb-4">Delete "{type.name}"?</p>
                  <div className="flex space-x-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleConfirmDelete(type.id)}
                    >
                      Delete
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'Create Conversation Type' : 'Edit Conversation Type'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="py-4">
              <label htmlFor="typeName" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <Input
                id="typeName"
                value={typeName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTypeName(e.target.value)}
                placeholder="Enter a descriptive name..."
                required
              />
            </div>
            
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button 
                type="submit" 
                disabled={isSubmitting || !typeName.trim()}
              >
                {isSubmitting ? 'Saving...' : dialogMode === 'create' ? 'Create' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}