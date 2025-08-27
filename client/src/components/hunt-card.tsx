import { useState } from "react";
import { Link } from "wouter";
import { Clock, DollarSign, Target, TrendingUp, Trash2, Copy, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeleteHunt } from "@/hooks/use-hunts";
import { useAdmin } from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import type { Hunt } from "@shared/schema";
import { formatCurrency } from "@/lib/currency";

interface HuntCardProps {
  hunt: Hunt;
  bonusCount?: number;
}

export function HuntCard({ hunt, bonusCount = 0 }: HuntCardProps) {
  const { isAdmin, user } = useAdmin();
  const deleteHunt = useDeleteHunt();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const statusColors = {
    collecting: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    opening: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    finished: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  const timeAgo = new Date(hunt.createdAt).toLocaleDateString();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete "${hunt.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteHunt.mutateAsync(hunt.id);
      toast({
        title: "Success",
        description: "Hunt deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to delete hunt",
        variant: "destructive",
      });
    }
  };

  const handleCopyOverlayLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user?.adminKey) {
      toast({
        title: "Error",
        description: "Admin key not found",
        variant: "destructive",
      });
      return;
    }

    const overlayUrl = `${window.location.origin}/overlay/${user.adminKey}`;
    
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Overlay link copied to clipboard",
      });
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy overlay link",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-dark-purple/50 border-purple-800/30 hover:bg-white/5 transition-colors">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">{hunt.title}</h3>
            <p className="text-gray-400 text-sm">{hunt.casino}</p>
          </div>
          <Badge className={statusColors[hunt.status as keyof typeof statusColors]}>
            {hunt.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center text-sm">
            <Target className="w-4 h-4 text-gray-400 mr-2" />
            <span className="text-gray-400">Bonuses:</span>
            <span className="text-white ml-1">{bonusCount}</span>
          </div>
          <div className="flex items-center text-sm">
            <Clock className="w-4 h-4 text-gray-400 mr-2" />
            <span className="text-gray-400">Created:</span>
            <span className="text-white ml-1">{timeAgo}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center text-sm">
            <DollarSign className="w-4 h-4 text-green-400 mr-2" />
            <span className="text-gray-400">Start:</span>
            <span className="text-green-400 ml-1">
              {formatCurrency(hunt.startBalance, hunt.currency as any)}
            </span>
          </div>
          {hunt.endBalance && (
            <div className="flex items-center text-sm">
              <TrendingUp className="w-4 h-4 text-green-400 mr-2" />
              <span className="text-gray-400">End:</span>
              <span className="text-green-400 ml-1">
                {formatCurrency(hunt.endBalance, hunt.currency as any)}
              </span>
            </div>
          )}
        </div>

        <div className="flex space-x-2">
          <Link href={`/hunts/${hunt.id}`} className="flex-1">
            <button 
              className="w-full bg-primary hover:bg-primary/90 text-white py-2 rounded-lg transition-colors text-sm"
              data-testid={`button-view-hunt-${hunt.id}`}
            >
              View Details
            </button>
          </Link>

          {isAdmin && user?.adminKey && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyOverlayLink}
              className="px-4 border-purple-600 text-purple-300 hover:bg-purple-600 hover:text-white text-xs"
              data-testid={`button-copy-overlay-${hunt.id}`}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  COPIED
                </>
              ) : (
                <>
                  OBS LINK
                  <Copy className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>
          )}

          {isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteHunt.isPending}
              className="px-3"
              data-testid={`button-delete-hunt-${hunt.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
