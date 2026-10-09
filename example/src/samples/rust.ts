export const rust = `use std::collections::HashMap;
use std::fmt;

/// A document revision with the edit that produced it.
#[derive(Debug, Clone, PartialEq)]
pub struct Revision {
    pub number: u32,
    pub inserted: String,
}

pub enum Change<'a> {
    Insert(&'a str),
    Delete(usize),
    Replace { start: usize, end: usize, text: &'a str },
}

impl fmt::Display for Revision {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "r{} (+{} chars)", self.number, self.inserted.len())
    }
}

pub fn apply(history: &mut HashMap<u32, Revision>, change: Change<'_>) -> Option<u32> {
    let next = history.len() as u32 + 1;
    let inserted = match change {
        Change::Insert(text) | Change::Replace { text, .. } => text.to_string(),
        Change::Delete(_) => String::new(),
    };
    history.insert(next, Revision { number: next, inserted });
    history.get(&next).map(|r| r.number)
}
`;
