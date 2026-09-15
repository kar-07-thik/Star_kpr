import React from 'react'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

export default function Vertical2ActivityCard({
  title,
  description,
  dropdownOptions = [],
  selectedValue,
  uploadedFileName,
  onSelectLevel,
  onUpload,
  onRemove,
}) {
  return (
    <div className="rounded-lg border border-rule bg-card p-4 space-y-4">
      <div>
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="space-y-2">
        <label className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Select certification level</label>
        <select
          value={selectedValue}
          onChange={(event) => onSelectLevel(event.target.value)}
          className="w-full rounded-md bg-card border border-rule px-3 py-2.5 text-sm focus-ring"
        >
          <option value="">Choose an option</option>
          {dropdownOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block rounded-md border border-dashed border-rule bg-paper p-5 text-center cursor-pointer hover:border-brand-500 transition-colors">
          <input type="file" className="hidden" onChange={onUpload} />
          <p className="text-sm text-slate-500">
            {uploadedFileName ? <span className="font-medium text-ink">{uploadedFileName}</span> : 'Click to choose a certificate file (PDF, JPG, PNG, Excel)'}
          </p>
        </label>

        {uploadedFileName && (
          <div className="flex items-center justify-between rounded-md border border-rule bg-paper px-3 py-2 text-sm text-slate-600">
            <span className="truncate">{uploadedFileName}</span>
            <button type="button" onClick={onRemove} className="ml-3 font-semibold text-red-500">Remove</button>
          </div>
        )}
      </div>
    </div>
  )
}
