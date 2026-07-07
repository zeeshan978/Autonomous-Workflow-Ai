import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { FolderOpen, Upload, Download, Trash2, Search, File, FileText, FileImage, FileSpreadsheet, FileArchive, Eye, HardDrive } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { getFiles, uploadFile, deleteFile } from '@/services/database';
import type { FileItem } from '@/types';

export function FilesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteFile_, setDeleteFile_] = useState<FileItem | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadFiles();
    }
  }, [user?.id]);

  const loadFiles = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getFiles(user.id);
      setFiles(data);
    } catch (error: any) { console.error(error); toast({ title: 'Failed to load files', description: error?.message || String(error), variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    let file: File | undefined;
    
    if ('dataTransfer' in e) {
      file = e.dataTransfer.files?.[0];
      setIsDragging(false);
    } else {
      file = e.target.files?.[0];
    }

    if (!file || !user?.id) return;

    setUploading(true);
    try {
      await uploadFile(user.id, file);
      toast({ title: 'File uploaded successfully' });
      loadFiles();
    } catch (error: any) { console.error(error); toast({ title: 'Failed to upload file', description: error?.message || String(error), variant: 'destructive' });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };

  const handleDelete = async (file: FileItem) => {
    try {
      await deleteFile(file.id);
      toast({ title: 'File deleted' });
      setDeleteFile_(null);
      loadFiles();
    } catch (error: any) { toast({ title: 'Failed to delete file', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const handleDownload = (file: FileItem) => {
    const a = document.createElement('a');
    a.href = file.storage_path;
    a.download = file.original_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return File;
    if (mimeType.startsWith('image/')) return FileImage;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
    if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
    if (mimeType.includes('zip') || mimeType.includes('archive')) return FileArchive;
    return File;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredFiles = files.filter(f =>
    f.original_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const maxStorage = 100 * 1024 * 1024; // 100 MB for display purposes
  const usagePercent = Math.min((totalBytes / maxStorage) * 100, 100);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Files</h1>
            <p className="text-muted-foreground">Manage your uploaded files</p>
          </div>
          <div>
            <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload File'}
            </Button>
          </div>
        </div>

        {/* Storage usage bar */}
        <Card className="bg-muted/50">
          <CardContent className="p-4 flex items-center gap-4">
            <HardDrive className="h-8 w-8 text-primary" />
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Storage Usage</span>
                <span className="text-muted-foreground">{formatSize(totalBytes)} / {formatSize(maxStorage)}</span>
              </div>
              <Progress value={usagePercent} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search files..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={handleUpload}
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
          <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <h3 className="text-lg font-medium mb-1">Drag and drop files here</h3>
          <p className="text-muted-foreground mb-4">or click to browse from your computer</p>
          <Button disabled={uploading}>
            {uploading ? 'Uploading...' : 'Select Files'}
          </Button>
        </div>

        {filteredFiles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredFiles.map((file) => {
              const FileIcon = getFileIcon(file.mime_type);
              const isImage = file.mime_type?.startsWith('image/');
              return (
                <motion.div key={file.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} layout>
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FileIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex gap-1">
                          {(isImage || file.mime_type?.includes('text') || file.mime_type?.includes('json')) && (
                            <Button variant="ghost" size="icon" onClick={() => setPreviewFile(file)}><Eye className="h-4 w-4" /></Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDownload(file)}><Download className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteFile_(file)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <p className="font-medium truncate" title={file.original_name}>{file.original_name}</p>
                      <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                        <span>{formatSize(file.size)}</span>
                        <span>{new Date(file.created_at).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.original_name}</DialogTitle>
            <DialogDescription>{formatSize(previewFile?.size || 0)} • {previewFile?.mime_type}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 border rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center min-h-[300px] max-h-[60vh]">
            {previewFile?.mime_type?.startsWith('image/') ? (
              <img src={previewFile.storage_path} alt={previewFile.original_name} className="max-w-full max-h-[60vh] object-contain" />
            ) : previewFile?.mime_type?.includes('text') || previewFile?.mime_type?.includes('json') ? (
              <iframe src={previewFile.storage_path} className="w-full h-[60vh] bg-white dark:bg-black" title="Preview" />
            ) : (
              <div className="text-muted-foreground">Preview not available for this file type.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFile_} onOpenChange={(open) => !open && setDeleteFile_(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deleteFile_?.original_name}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteFile_ && handleDelete(deleteFile_)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
