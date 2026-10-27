import { useState, type DragEvent } from 'react'

interface UseDragDropResult {
  draggedDigit: number | null
  draggedCellIndex: number | null
  onDragStart: (digit: number) => (event: DragEvent<HTMLButtonElement>) => void
  onCellDragStart: (cellIndex: number, digit: number) => (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDrop: (cellIndex: number) => (event: DragEvent<HTMLElement>) => void
}

export function useDragDrop(
  onDropDigit: (digit: number, cellIndex: number) => void,
  onSwapDigits: (fromIndex: number, toIndex: number) => void,
): UseDragDropResult {
  const [draggedDigit, setDraggedDigit] = useState<number | null>(null)
  const [draggedCellIndex, setDraggedCellIndex] = useState<number | null>(null)

  function onDragStart(digit: number) {
    return (event: DragEvent<HTMLButtonElement>) => {
      setDraggedDigit(digit)
      setDraggedCellIndex(null)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(digit))
    }
  }

  function onCellDragStart(cellIndex: number, digit: number) {
    return (event: DragEvent<HTMLButtonElement>) => {
      setDraggedDigit(digit)
      setDraggedCellIndex(cellIndex)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('application/x-tessera-cell', String(cellIndex))
      event.dataTransfer.setData('text/plain', `cell:${cellIndex}`)
    }
  }

  function onDragEnd() {
    setDraggedDigit(null)
    setDraggedCellIndex(null)
  }

  function onDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function onDrop(cellIndex: number) {
    return (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      const customSourceCell = event.dataTransfer.getData('application/x-tessera-cell')
      const textPayload = event.dataTransfer.getData('text/plain')
      const sourceCell = customSourceCell || (textPayload.startsWith('cell:') ? textPayload.slice(5) : '')
      if (sourceCell !== '') {
        const fromIndex = Number(sourceCell)
        if (Number.isInteger(fromIndex)) onSwapDigits(fromIndex, cellIndex)
        setDraggedDigit(null)
        setDraggedCellIndex(null)
        return
      }

      const rawDigit = textPayload
      const digit = Number(rawDigit)
      if (Number.isInteger(digit)) onDropDigit(digit, cellIndex)
      setDraggedDigit(null)
      setDraggedCellIndex(null)
    }
  }

  return {
    draggedDigit,
    draggedCellIndex,
    onDragStart,
    onCellDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
  }
}
