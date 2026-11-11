export const dtd = `<!-- The structure of a note document. -->
<!ELEMENT note (to, from, heading, body)>
<!ATTLIST note
  id ID #REQUIRED
  lang CDATA "en">
<!ELEMENT to (#PCDATA)>
<!ELEMENT from (#PCDATA)>
<!ELEMENT heading (#PCDATA)>
<!ELEMENT body (#PCDATA)>
<!ENTITY copy "&#169;">
<!ENTITY % common SYSTEM "common.dtd">
%common;
`;
