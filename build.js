const fs = require('fs')

const unified = require('unified')
const remarkParse = require('remark-parse')
const remarkCompile = require('remark-stringify')

const find = require('unist-util-find')
const visit = require('unist-util-visit')
const h = require('unist-builder')

const reader = unified()
  .use(remarkParse)
const writer = unified()
  .use(remarkCompile)

const backlinksTitle = 'Links to this note'

const isMarkdownFile = /.md$/
const isInternalLink = /.md$/

const notesStore = fs.readdirSync('./concepts/')
  .filter(name => isMarkdownFile.test(name))
  .map(name => {
    const contents = fs.readFileSync(`./concepts/${name}`, { encoding: 'utf-8' })
    const tree = reader.parse(contents)

    return {
      name,
      tree,
      title: [],
      links: {
        to: [],
        from: []
      }
    }
  })

notesStore.forEach(note => {
  // Remove any existing backlink sections so that they don't
  // interfere with our list of backlinks. This assumes the
  // backlinks section appear at the end of a file.
  const backlinksHeadingIndex = note.tree.children.findIndex(node => (
    node.type === 'heading' &&
    node.children[0].type === 'text' &&
    node.children[0].value === backlinksTitle
  ))

  if (backlinksHeadingIndex !== -1) {
    note.tree.children.splice(backlinksHeadingIndex)
  }

  // Generate a list of links to and from a note
  visit(note.tree, 'link', node => {
    if (isInternalLink.test(node.url)) {
      note.links.to.push(node.url)

      notesStore.find(note => node.url === `/concepts/${note.name}`)
        .links.from.push(note.name)
    }
  })

  // Get the title children (without position)
  note.title = find(note.tree, node => (
    node.type === 'heading' && node.depth === 1
  )).children
    .map(child => ({ ...child, position: undefined }))
})

// Build the backlinks section for each note
notesStore.forEach(note => {
  if (note.links.from.length !== 0) {
    note.tree.children = note.tree.children.concat([
      h('heading', { depth: 2 }, [ h('text', backlinksTitle) ]),
      h('list', { ordered: false }, note.links.from.map(note => (
        h('listItem', [
          h('paragraph', [
            h('link', { url: `/concepts/${note}` }, notesStore.find(to => to.name === note).title)
          ])
        ])
      )))
    ])
  }
})

// Write the updatd markdown files
notesStore.forEach(note => {
  fs.writeFileSync(`./concepts/${note.name}`, writer.stringify(note.tree))
})
