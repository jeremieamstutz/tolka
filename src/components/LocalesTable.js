"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { updateTranslation, deleteTranslationKey, createTranslationKey, createNewLocale, deleteLocaleAction, generateTranslation, renameTranslationKey, getMetadataAction, updateMetadataAction, getSourceLocaleAction, setSourceLocaleAction } from "@/app/actions"
import { Trash2, Plus, Search, X, ChevronDown, Globe, Sparkles, Loader2, Info, Tag, Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"

function flatten(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flatten(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

function setDeep(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
  return obj;
}

export function LocalesTable({ initialData }) {
  const router = useRouter()
  const [data, setData] = useState(initialData || { locales: [], data: {} })
  const [keys, setKeys] = useState([])
  const [flattenedData, setFlattenedData] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [savingStates, setSavingStates] = useState({}) // Track saving state: { "locale-key": true/false }
  const [selectedLocales, setSelectedLocales] = useState(new Set()) // Track selected locales for filtering
  const [isAddLocaleDialogOpen, setIsAddLocaleDialogOpen] = useState(false)
  const [newLocaleName, setNewLocaleName] = useState('')
  const [isDeleteLocaleDialogOpen, setIsDeleteLocaleDialogOpen] = useState(false)
  const [localeToDelete, setLocaleToDelete] = useState('')
  const [aiGeneratingStates, setAiGeneratingStates] = useState({}) // Track AI generation state: { "locale-key": true/false }
  const [isBulkGenerating, setIsBulkGenerating] = useState(false) // Track bulk AI generation state
  const [editingKey, setEditingKey] = useState(null) // Track which key is being edited: "oldKey" or null
  const [editingKeyValue, setEditingKeyValue] = useState('') // Track the value being edited
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false)
  const [currentMetadataKey, setCurrentMetadataKey] = useState(null)
  const [metadata, setMetadata] = useState({}) // Store metadata for all keys
  const [sourceLocale, setSourceLocale] = useState('en') // Project-level source locale
  const [isSourceLocaleDialogOpen, setIsSourceLocaleDialogOpen] = useState(false)
  const [sourceLocaleForm, setSourceLocaleForm] = useState('en') // Temporary state for dialog
  const [metadataForm, setMetadataForm] = useState({
    notes: '',
    tags: '',
    status: 'active',
  })

  useEffect(() => {
    if (initialData) {
        processData(initialData)
        // Initialize selected locales to all locales by default
        if (initialData.locales && initialData.locales.length > 0) {
          setSelectedLocales(new Set(initialData.locales))
        }
        // Load metadata
        if (initialData.metadata) {
          setMetadata(initialData.metadata)
        }
        // Load source locale from config
        if (initialData.sourceLocale) {
          setSourceLocale(initialData.sourceLocale)
        }
    }
  }, [initialData])

  const processData = (json) => {
    setData(json)
    
    const flatData = {}
    const allKeys = new Set()
    
    json.locales.forEach(locale => {
        flatData[locale] = flatten(json.data[locale] || {})
        Object.keys(flatData[locale]).forEach(k => allKeys.add(k))
    })
    
    setFlattenedData(flatData)
    setKeys(Array.from(allKeys).sort())
  }

  const handleLocalChange = (locale, key, value) => {
    const newFlatData = { ...flattenedData }
    if (!newFlatData[locale]) newFlatData[locale] = {}
    newFlatData[locale][key] = value
    setFlattenedData(newFlatData)
  }

  const handleSave = async (locale, key, value) => {
    const savingKey = `${locale}-${key}`
    
    // Set saving state to true
    setSavingStates(prev => ({ ...prev, [savingKey]: true }))
    
    const newData = { ...data }
    if (!newData.data[locale]) newData.data[locale] = {}
    
    const localeData = JSON.parse(JSON.stringify(newData.data[locale]))
    setDeep(localeData, key, value)
    newData.data[locale] = localeData
    
    setData(newData)

    await updateTranslation(locale, localeData)
    
    // Update metadata updated_at timestamp
    try {
      // Get existing metadata to preserve it, then update just the timestamp
      const existingMeta = metadata[key] || {
        notes: '',
        tags: [],
        status: 'active',
      }
      await updateMetadataAction(key, existingMeta)
      
      // Update local metadata state
      const newMetadata = { ...metadata }
      newMetadata[key] = {
        ...existingMeta,
        created_at: existingMeta.created_at || new Date().toISOString(), // Preserve created_at or set if new
        updated_at: new Date().toISOString(),
      }
      setMetadata(newMetadata)
    } catch (error) {
      console.error('Failed to update metadata timestamp:', error)
      // Don't fail the save if metadata update fails
    }
    
    // Set saving state to false after save completes
    setSavingStates(prev => ({ ...prev, [savingKey]: false }))
  }

  const handleDelete = async (key) => {
    if (!confirm(`Are you sure you want to delete the translation key "${key}"?`)) {
      return
    }

    // Update all locale files
    await deleteTranslationKey(key)
    
    // Remove from local state
    const newKeys = keys.filter(k => k !== key)
    setKeys(newKeys)
    
    const newFlatData = { ...flattenedData }
    data.locales.forEach(locale => {
      if (newFlatData[locale]) {
        delete newFlatData[locale][key]
      }
    })
    setFlattenedData(newFlatData)

    // Refresh the page data
    router.refresh()
  }

  const handleKeyClick = (key) => {
    setEditingKey(key)
    setEditingKeyValue(key)
  }

  const handleKeyBlur = async (oldKey) => {
    if (!editingKey) return
    
    const newKey = editingKeyValue.trim()
    
    // If the key hasn't changed, just cancel editing
    if (newKey === oldKey) {
      setEditingKey(null)
      setEditingKeyValue('')
      return
    }
    
    // Validate the new key
    if (!newKey) {
      alert('Key cannot be empty')
      setEditingKey(null)
      setEditingKeyValue('')
      return
    }
    
    // Check if the new key already exists
    if (keys.includes(newKey) && newKey !== oldKey) {
      alert(`Key "${newKey}" already exists`)
      setEditingKey(null)
      setEditingKeyValue('')
      return
    }
    
    try {
      // Rename the key in all locales
      await renameTranslationKey(oldKey, newKey)
      
      // Update local state
      const newKeys = keys.map(k => k === oldKey ? newKey : k).sort()
      setKeys(newKeys)
      
      // Update flattened data
      const newFlatData = { ...flattenedData }
      data.locales.forEach(locale => {
        if (newFlatData[locale] && newFlatData[locale][oldKey] !== undefined) {
          newFlatData[locale][newKey] = newFlatData[locale][oldKey]
          delete newFlatData[locale][oldKey]
        }
      })
      setFlattenedData(newFlatData)
      
      // Update nested data structure
      const newData = { ...data }
      data.locales.forEach(locale => {
        if (newData.data[locale]) {
          const localeData = JSON.parse(JSON.stringify(newData.data[locale]))
          const value = getDeep(localeData, oldKey)
          if (value !== undefined) {
            setDeep(localeData, newKey, value)
            deleteDeep(localeData, oldKey)
            newData.data[locale] = localeData
          }
        }
      })
      setData(newData)
      
      // Clear editing state
      setEditingKey(null)
      setEditingKeyValue('')
      
      // Refresh the page data
      router.refresh()
    } catch (error) {
      alert(error.message || 'Failed to rename key')
      setEditingKey(null)
      setEditingKeyValue('')
    }
  }

  const handleKeyKeyDown = (e, oldKey) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleKeyBlur(oldKey)
    } else if (e.key === 'Escape') {
      setEditingKey(null)
      setEditingKeyValue('')
    }
  }
  
  // Helper function to get deep value (similar to getDeep in fs-utils)
  const getDeep = (obj, path) => {
    const keys = path.split('.')
    let current = obj
    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined
      }
      current = current[key]
    }
    return current
  }
  
  // Helper function to delete deep (similar to deleteDeep in fs-utils)
  const deleteDeep = (obj, path) => {
    const keys = path.split('.')
    let current = obj
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!current[key] || typeof current[key] !== 'object') {
        return obj // Path doesn't exist
      }
      current = current[key]
    }
    delete current[keys[keys.length - 1]]
    
    // Clean up empty objects
    let parent = obj
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (Object.keys(parent[key]).length === 0) {
        delete parent[key]
        break
      }
      parent = parent[key]
    }
    
    return obj
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      return
    }

    const trimmedKey = newKeyName.trim()

    // Check if key already exists
    if (keys.includes(trimmedKey)) {
      alert(`Key "${trimmedKey}" already exists`)
      return
    }

    // Optimistically update local state
    const newKeys = [...keys, trimmedKey].sort()
    setKeys(newKeys)
    
    // Add empty value for the new key in all locales
    const newFlatData = { ...flattenedData }
    data.locales.forEach(locale => {
      if (!newFlatData[locale]) newFlatData[locale] = {}
      newFlatData[locale][trimmedKey] = ''
    })
    setFlattenedData(newFlatData)
    
    // Update nested data structure
    const newData = { ...data }
    data.locales.forEach(locale => {
      if (!newData.data[locale]) newData.data[locale] = {}
      const localeData = JSON.parse(JSON.stringify(newData.data[locale]))
      setDeep(localeData, trimmedKey, '')
      newData.data[locale] = localeData
    })
    setData(newData)
    
    // Reset form and filter search to the new key
    setNewKeyName('')
    setIsCreateDialogOpen(false)
    setSearchQuery(trimmedKey)
    
    // Save to server
    await createTranslationKey(trimmedKey, '')
    
    // Refresh the page data to ensure sync
    router.refresh()
  }

  const handleToggleLocale = (locale) => {
    const newSelected = new Set(selectedLocales)
    if (newSelected.has(locale)) {
      newSelected.delete(locale)
    } else {
      newSelected.add(locale)
    }
    setSelectedLocales(newSelected)
  }

  const handleSelectAllLocales = () => {
    setSelectedLocales(new Set(data.locales))
  }

  const handleDeselectAllLocales = () => {
    setSelectedLocales(new Set())
  }

  const handleCreateLocale = async () => {
    if (!newLocaleName.trim()) {
      return
    }

    const trimmedLocale = newLocaleName.trim().toLowerCase()

    // Check if locale already exists
    if (data.locales.includes(trimmedLocale)) {
      alert(`Locale "${trimmedLocale}" already exists`)
      return
    }

    try {
      // Create the locale file
      await createNewLocale(trimmedLocale)
      
      // Reset form
      setNewLocaleName('')
      setIsAddLocaleDialogOpen(false)
      
      // Refresh the page data to get the new locale
      router.refresh()
    } catch (error) {
      alert(error.message || 'Failed to create locale')
    }
  }

  const handleDeleteLocale = async () => {
    if (!localeToDelete) {
      return
    }

    try {
      // Delete the locale file
      await deleteLocaleAction(localeToDelete)
      
      // Remove from selected locales if it was selected
      const newSelected = new Set(selectedLocales)
      newSelected.delete(localeToDelete)
      setSelectedLocales(newSelected)
      
      // Reset form and close dialog
      setLocaleToDelete('')
      setIsDeleteLocaleDialogOpen(false)
      
      // Refresh the page data to reflect the deletion
      router.refresh()
    } catch (error) {
      alert(error.message || 'Failed to delete locale')
    }
  }

  const handleDeleteLocaleClick = (locale, e) => {
    e.stopPropagation()
    setLocaleToDelete(locale)
    setIsDeleteLocaleDialogOpen(true)
  }

  const handleBulkAIGenerate = async () => {
    if (isBulkGenerating) return

    // Filter keys based on search query (same logic as in render)
    const filteredKeys = keys.filter(key => 
      key.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Find all missing translations
    const missingTranslations = []
    
    for (const key of filteredKeys) {
      for (const locale of data.locales) {
        const value = flattenedData[locale]?.[key] || ''
        if (!value.trim()) {
          // Check if there are reference translations available
          const hasReference = data.locales.some(otherLocale => 
            otherLocale !== locale && 
            flattenedData[otherLocale]?.[key]?.trim().length > 0
          )
          
          if (hasReference) {
            missingTranslations.push({ locale, key })
          }
        }
      }
    }

    if (missingTranslations.length === 0) {
      alert('No missing translations found that can be generated with AI')
      return
    }

    if (!confirm(`Generate AI translations for ${missingTranslations.length} missing value(s)?`)) {
      return
    }

    setIsBulkGenerating(true)

    let successCount = 0
    let errorCount = 0

    // Process translations sequentially to avoid rate limits
    for (const { locale, key } of missingTranslations) {
      const generatingKey = `${locale}-${key}`
      
      try {
        // Set generating state
        setAiGeneratingStates(prev => ({ ...prev, [generatingKey]: true }))

        // Collect existing translations (at most 2), prioritizing source locale
        const existingTranslations = {}
        let count = 0
        
        // First, try to add the source locale if it exists and is not the target locale
        if (sourceLocale !== locale && data.locales.includes(sourceLocale)) {
          const sourceValue = flattenedData[sourceLocale]?.[key]
          if (sourceValue && sourceValue.trim().length > 0) {
            existingTranslations[sourceLocale] = sourceValue
            count++
          }
        }
        
        // Then add other locales up to the limit
        for (const otherLocale of data.locales) {
          if (otherLocale !== locale && otherLocale !== sourceLocale && count < 2) {
            const otherValue = flattenedData[otherLocale]?.[key]
            if (otherValue && otherValue.trim().length > 0) {
              existingTranslations[otherLocale] = otherValue
              count++
            }
          }
        }

        if (count > 0) {
          // Generate translation
          const result = await generateTranslation(key, locale, existingTranslations)
          
          if (result.success && result.translation) {
            // Update local state
            handleLocalChange(locale, key, result.translation)
            // Save to server
            await handleSave(locale, key, result.translation)
            successCount++
          }
        }
      } catch (error) {
        console.error(`Failed to generate translation for ${locale}-${key}:`, error)
        errorCount++
      } finally {
        // Clear generating state
        setAiGeneratingStates(prev => ({ ...prev, [generatingKey]: false }))
      }
    }

    setIsBulkGenerating(false)

    if (errorCount > 0) {
      alert(`Completed: ${successCount} translations generated, ${errorCount} failed`)
    } else {
      alert(`Successfully generated ${successCount} translations`)
    }
  }

  const handleOpenMetadataDialog = async (key) => {
    setCurrentMetadataKey(key)
    const keyMeta = metadata[key] || {
      notes: '',
      tags: [],
      status: 'active',
    }
    setMetadataForm({
      notes: keyMeta.notes || '',
      tags: Array.isArray(keyMeta.tags) ? keyMeta.tags.join(', ') : '',
      status: keyMeta.status || 'active',
    })
    setIsMetadataDialogOpen(true)
  }

  const handleSaveMetadata = async () => {
    if (!currentMetadataKey) return

    const tagsArray = metadataForm.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)

    const updatedMetadata = {
      notes: metadataForm.notes,
      tags: tagsArray,
      status: metadataForm.status,
    }

    try {
      await updateMetadataAction(currentMetadataKey, updatedMetadata)
      
      // Update local metadata state
      const newMetadata = { ...metadata }
      const existingMeta = metadata[currentMetadataKey] || {}
      newMetadata[currentMetadataKey] = {
        ...updatedMetadata,
        created_at: existingMeta.created_at || new Date().toISOString(), // Preserve created_at or set if new
        updated_at: new Date().toISOString(),
      }
      setMetadata(newMetadata)
      
      setIsMetadataDialogOpen(false)
      router.refresh()
    } catch (error) {
      alert(error.message || 'Failed to save metadata')
    }
  }

  const handleOpenSourceLocaleDialog = () => {
    setSourceLocaleForm(sourceLocale)
    setIsSourceLocaleDialogOpen(true)
  }

  const handleSaveSourceLocale = async () => {
    try {
      await setSourceLocaleAction(sourceLocaleForm)
      setSourceLocale(sourceLocaleForm)
      setIsSourceLocaleDialogOpen(false)
      router.refresh()
    } catch (error) {
      alert(error.message || 'Failed to save source locale')
    }
  }

  const handleAIGenerate = async (locale, key) => {
    const generatingKey = `${locale}-${key}`
    
    // Set generating state to true
    setAiGeneratingStates(prev => ({ ...prev, [generatingKey]: true }))
    
    try {
      // Collect existing translations (at most 2), prioritizing source locale
      const existingTranslations = {}
      let count = 0
      
      // First, try to add the source locale if it exists and is not the target locale
      if (sourceLocale !== locale && data.locales.includes(sourceLocale)) {
        const sourceValue = flattenedData[sourceLocale]?.[key]
        if (sourceValue && sourceValue.trim().length > 0) {
          existingTranslations[sourceLocale] = sourceValue
          count++
        }
      }
      
      // Then add other locales up to the limit
      for (const otherLocale of data.locales) {
        if (otherLocale !== locale && otherLocale !== sourceLocale && count < 2) {
          const otherValue = flattenedData[otherLocale]?.[key]
          if (otherValue && otherValue.trim().length > 0) {
            existingTranslations[otherLocale] = otherValue
            count++
          }
        }
      }

      if (count === 0) {
        alert('No existing translations available to use as reference')
        return
      }

      // Generate translation
      const result = await generateTranslation(key, locale, existingTranslations)
      
      if (result.success && result.translation) {
        // Update local state
        handleLocalChange(locale, key, result.translation)
        // Save to server
        await handleSave(locale, key, result.translation)
      }
    } catch (error) {
      alert(error.message || 'Failed to generate translation')
    } finally {
      // Set generating state to false
      setAiGeneratingStates(prev => ({ ...prev, [generatingKey]: false }))
    }
  }

  // Filter locales based on selection
  const visibleLocales = data.locales.filter(locale => selectedLocales.has(locale))

  // Filter keys based on search query
  const filteredKeys = keys.filter(key => 
    key.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Count words only from source locale for filtered keys
  const countWords = () => {
    let totalWords = 0
    filteredKeys.forEach(key => {
      // Use project-level source locale
      let value = flattenedData[sourceLocale]?.[key] || ''
      
      // If source locale doesn't have a value, try to find first locale that does
      if (!value || value.trim().length === 0) {
        for (const locale of data.locales) {
          const localeValue = flattenedData[locale]?.[key] || ''
          if (localeValue && localeValue.trim().length > 0) {
            value = localeValue
            break
          }
        }
      }
      
      if (value && typeof value === 'string') {
        // Count words by splitting on whitespace and filtering out empty strings
        const words = value.trim().split(/\s+/).filter(word => word.length > 0)
        totalWords += words.length
      }
    })
    return totalWords
  }

  const totalWords = countWords()

  if (!data.locales.length && !Object.keys(data.data).length) return <div className="p-8">No locales found.</div>

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Language dropdown, Search bar and Create button */}
      <div className="flex items-center gap-3">
      <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-9 ${searchQuery ? 'pr-9' : ''}`}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Key
        </Button>
      </div>
      <div className="flex justify-between w-full items-center">
        <div className="flex items-center gap-4">
          <p>Found {filteredKeys.length} keys, {totalWords} words</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenSourceLocaleDialog}
            className="text-xs"
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Source: {sourceLocale.toUpperCase()}
          </Button>
        </div>
      <div className="flex items-center gap-3">
      <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-[140px] justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span className="text-sm">
                  {selectedLocales.size === 0 
                    ? 'No languages' 
                    : selectedLocales.size === data.locales.length 
                    ? 'All languages' 
                    : `${selectedLocales.size} selected`}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Languages</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleSelectAllLocales}
              onSelect={(e) => e.preventDefault()}
            >
              Select All
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleDeselectAllLocales}
              onSelect={(e) => e.preventDefault()}
            >
              Deselect All
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {data.locales.map(locale => (
              <DropdownMenuCheckboxItem
                key={locale}
                checked={selectedLocales.has(locale)}
                onCheckedChange={() => handleToggleLocale(locale)}
                onSelect={(e) => e.preventDefault()}
                className="flex items-center justify-between pr-1"
              >
                <span>{locale.toUpperCase()}</span>
                <button
                  onClick={(e) => handleDeleteLocaleClick(locale, e)}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="ml-auto p-1 hover:bg-destructive/10 rounded transition-colors"
                  aria-label={`Delete ${locale}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsAddLocaleDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Language
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button 
          onClick={handleBulkAIGenerate}
          disabled={isBulkGenerating}
          variant="outline"
        >
          {isBulkGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Translate All
            </>
          )}
        </Button>
      </div>
      </div>

      {/* Create Key Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Key</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="text"
              placeholder="Key name (e.g., common.greeting)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateKey()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKey}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Language Dialog */}
      <Dialog open={isAddLocaleDialogOpen} onOpenChange={setIsAddLocaleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Language</DialogTitle>
            <DialogDescription>
              Enter the language code (e.g., "en", "fr", "es", "de")
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="text"
              placeholder="en"
              value={newLocaleName}
              onChange={(e) => setNewLocaleName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateLocale()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddLocaleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLocale}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Language Confirmation Dialog */}
      <Dialog open={isDeleteLocaleDialogOpen} onOpenChange={setIsDeleteLocaleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Language</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the language "{localeToDelete.toUpperCase()}"? This will permanently delete the locale file and all its translations. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDeleteLocaleDialogOpen(false)
              setLocaleToDelete('')
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteLocale}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Source Locale Dialog */}
      <Dialog open={isSourceLocaleDialogOpen} onOpenChange={setIsSourceLocaleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project Source Language</DialogTitle>
            <DialogDescription>
              Set the source language for this project. This will be used as the reference language for AI translations and word counting.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Source Language</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={sourceLocaleForm}
                onChange={(e) => setSourceLocaleForm(e.target.value)}
              >
                {data.locales.map(locale => (
                  <option key={locale} value={locale}>
                    {locale.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSourceLocaleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSourceLocale}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Metadata Dialog */}
      <Dialog open={isMetadataDialogOpen} onOpenChange={setIsMetadataDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Metadata for "{currentMetadataKey}"</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Additional notes or context about this translation"
                value={metadataForm.notes}
                onChange={(e) => setMetadataForm({ ...metadataForm, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags (comma-separated)</label>
              <Input
                placeholder="e.g., ui, navigation, error"
                value={metadataForm.tags}
                onChange={(e) => setMetadataForm({ ...metadataForm, tags: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={metadataForm.status}
                onChange={(e) => setMetadataForm({ ...metadataForm, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="deprecated">Deprecated</option>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMetadataDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMetadata}>
              Save Metadata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filtered keys list */}
      {filteredKeys.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? `No keys found matching "${searchQuery}"` : 'No keys found'}
        </div>
      ) : (
        filteredKeys.map(key => (
        <Card key={key}>
          <CardHeader className="flex flex-row items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2 flex-1">
              {editingKey === key ? (
                <Input
                  type="text"
                  value={editingKeyValue}
                  onChange={(e) => setEditingKeyValue(e.target.value)}
                  onBlur={() => handleKeyBlur(key)}
                  onKeyDown={(e) => handleKeyKeyDown(e, key)}
                  className="font-mono text-sm font-medium h-8"
                  autoFocus
                />
              ) : (
                <span 
                  className="font-mono text-sm font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleKeyClick(key)}
                  title="Click to rename"
                >
                  {key}
                </span>
              )}
              {metadata[key] && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {metadata[key].tags && metadata[key].tags.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      <span>{metadata[key].tags.length}</span>
                    </div>
                  )}
                  {metadata[key].status && metadata[key].status !== 'active' && (
                    <span className="px-1.5 py-0.5 rounded bg-muted text-xs">{metadata[key].status}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">
                {metadata[key]?.updated_at 
                  ? new Date(metadata[key].updated_at).toLocaleDateString()
                  : 'never updated'}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleOpenMetadataDialog(key)}
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                disabled={editingKey === key}
                title="Edit metadata"
              >
                <Info className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(key)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                disabled={editingKey === key}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {visibleLocales.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No languages selected. Select languages from the dropdown above.
              </div>
            ) : (
              visibleLocales.map(locale => {
                const savingKey = `${locale}-${key}`
                const generatingKey = `${locale}-${key}`
                const value = flattenedData[locale]?.[key] || ''
                const isSaving = savingStates[savingKey] || false
                const isGenerating = aiGeneratingStates[generatingKey] || false
                const hasValue = value.trim().length > 0
                
                // Determine border color: yellow if saving/generating, green if has value, red if no value
                let borderColorClass = 'border-l-red-300'
                if (isSaving || isGenerating) {
                  borderColorClass = 'border-l-yellow-400'
                } else if (hasValue) {
                  borderColorClass = 'border-l-green-300'
                }
                
                // Check if there are existing translations to use as reference
                const hasReferenceTranslations = data.locales.some(otherLocale => 
                  otherLocale !== locale && 
                  flattenedData[otherLocale]?.[key]?.trim().length > 0
                )
                
                return (
                  <div key={`${locale}-${key}`} className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-6 h-10 shrink-0">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">{locale}</span>
                    </div>
                    <div className="flex-1 relative">
                      <Textarea
                        value={value} 
                        onChange={(e) => {
                          handleLocalChange(locale, key, e.target.value)
                          // Auto-resize textarea
                          e.target.style.height = 'auto'
                          e.target.style.height = `${e.target.scrollHeight}px`
                        }}
                        onBlur={(e) => handleSave(locale, key, e.target.value)}
                        className={`w-full min-h-[40px] resize-y border-l-[3px] ${borderColorClass} ${!hasValue ? 'pr-10' : ''}`}
                        rows={1}
                        disabled={isGenerating}
                      />
                      {!hasValue && hasReferenceTranslations && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAIGenerate(locale, key)}
                          disabled={isGenerating}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-primary"
                          title="Generate translation with AI"
                        >
                          {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
        ))
      )}
    </div>
  )
}
