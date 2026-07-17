export function remapWorkflowIDs(nodes: any[], edges: any[]) {
  const idMap = new Map<string, string>();
  
  // 1. Generate new IDs for nodes
  const newNodes = nodes.map(n => {
    // Generate unique id, avoiding collision
    const newId = `node-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    idMap.set(n.id, newId);
    return { ...n, id: newId };
  });

  // 2. Remap edges
  const newEdges = edges.map(e => {
    return {
      ...e,
      id: `edge-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      source: idMap.get(e.source) || e.source,
      target: idMap.get(e.target) || e.target,
    };
  });

  // 3. Deep config update (search and replace old IDs with new IDs in config strings)
  newNodes.forEach(n => {
    if (n.data && n.data.config) {
      let configString = JSON.stringify(n.data.config);
      // Replace all occurrences of old node IDs
      idMap.forEach((newId, oldId) => {
        // use regex to match exactly the oldId in string patterns
        // We match exactly the ID, bounded by non-word chars (like quotes or underscores/dots)
        // Since node IDs are like node-1234, word boundaries \b might not work perfectly because hyphen is a word boundary.
        // It's safer to just replace globally if it looks exactly like the old ID.
        const regex = new RegExp(oldId, 'g');
        configString = configString.replace(regex, newId);
      });
      n.data.config = JSON.parse(configString);
    }
  });

  return { nodes: newNodes, edges: newEdges };
}
