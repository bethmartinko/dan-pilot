{\rtf1\ansi\ansicpg1252\cocoartf2761
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\froman\fcharset0 Times-Roman;}
{\colortbl;\red255\green255\blue255;\red0\green0\blue0;\red16\green19\blue24;\red32\green36\blue45;
\red4\green57\blue181;\red108\green0\blue181;\red168\green59\blue9;\red15\green112\blue1;\red167\green0\blue20;
\red14\green110\blue109;\red162\green55\blue4;}
{\*\expandedcolortbl;;\cssrgb\c0\c0\c0;\cssrgb\c7843\c9412\c12157;\cssrgb\c16863\c18824\c23137;
\cssrgb\c0\c31765\c76078;\cssrgb\c50588\c0\c76078;\cssrgb\c72157\c30980\c1961;\cssrgb\c0\c50196\c0;\cssrgb\c72157\c3922\c9412;
\cssrgb\c0\c50196\c50196;\cssrgb\c70196\c29020\c0;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\pardeftab720\partightenfactor0

\f0\fs24 \cf0 \expnd0\expndtw0\kerning0
\outl0\strokewidth0 \strokec2 javascript\
\pard\pardeftab720\partightenfactor0
\cf3 \strokec3 exports\cf4 \strokec4 .\cf5 \strokec5 handler\cf3 \strokec3  = \cf6 \strokec6 async\cf3 \strokec3  \cf6 \strokec6 function\cf3 \strokec3  \cf4 \strokec4 (\cf7 \strokec7 event\cf4 \strokec4 )\cf3 \strokec3  \cf4 \strokec4 \{\cf3 \strokec3 \
  \cf6 \strokec6 if\cf3 \strokec3  \cf4 \strokec4 (\cf3 \strokec3 event\cf4 \strokec4 .\cf3 \strokec3 httpMethod !== \cf8 \strokec8 "POST"\cf4 \strokec4 )\cf3 \strokec3  \cf4 \strokec4 \{\cf3 \strokec3 \
    \cf6 \strokec6 return\cf3 \strokec3  \cf4 \strokec4 \{\cf3 \strokec3  \cf9 \strokec9 statusCode\cf3 \strokec3 : \cf10 \strokec10 405\cf4 \strokec4 ,\cf3 \strokec3  \cf9 \strokec9 body\cf3 \strokec3 : \cf8 \strokec8 "Method Not Allowed"\cf3 \strokec3  \cf4 \strokec4 \};\cf3 \strokec3 \
  \cf4 \strokec4 \}\cf3 \strokec3 \
\
  \cf6 \strokec6 const\cf3 \strokec3  target = event\cf4 \strokec4 .\cf3 \strokec3 headers\cf4 \strokec4 [\cf8 \strokec8 "x-target"\cf4 \strokec4 ];\cf3 \strokec3 \
\
  \cf6 \strokec6 if\cf3 \strokec3  \cf4 \strokec4 (\cf3 \strokec3 target === \cf8 \strokec8 "anthropic"\cf4 \strokec4 )\cf3 \strokec3  \cf4 \strokec4 \{\cf3 \strokec3 \
    \cf6 \strokec6 const\cf3 \strokec3  response = \cf6 \strokec6 await\cf3 \strokec3  \cf5 \strokec5 fetch\cf4 \strokec4 (\cf8 \strokec8 "https://api.anthropic.com/v1/messages"\cf4 \strokec4 ,\cf3 \strokec3  \cf4 \strokec4 \{\cf3 \strokec3 \
      \cf9 \strokec9 method\cf3 \strokec3 : \cf8 \strokec8 "POST"\cf4 \strokec4 ,\cf3 \strokec3 \
      \cf9 \strokec9 headers\cf3 \strokec3 : \cf4 \strokec4 \{\cf3 \strokec3 \
        \cf9 \strokec9 "Content-Type"\cf3 \strokec3 : \cf8 \strokec8 "application/json"\cf4 \strokec4 ,\cf3 \strokec3 \
        \cf9 \strokec9 "x-api-key"\cf3 \strokec3 : process\cf4 \strokec4 .\cf3 \strokec3 env\cf4 \strokec4 .\cf10 \strokec10 ANTHROPIC_API_KEY\cf4 \strokec4 ,\cf3 \strokec3 \
        \cf9 \strokec9 "anthropic-version"\cf3 \strokec3 : \cf8 \strokec8 "2023-06-01"\cf4 \strokec4 ,\cf3 \strokec3 \
      \cf4 \strokec4 \},\cf3 \strokec3 \
      \cf9 \strokec9 body\cf3 \strokec3 : event\cf4 \strokec4 .\cf3 \strokec3 body\cf4 \strokec4 ,\cf3 \strokec3 \
    \cf4 \strokec4 \});\cf3 \strokec3 \
    \cf6 \strokec6 const\cf3 \strokec3  data = \cf6 \strokec6 await\cf3 \strokec3  response\cf4 \strokec4 .\cf5 \strokec5 text\cf4 \strokec4 ();\cf3 \strokec3 \
    \cf6 \strokec6 return\cf3 \strokec3  \cf4 \strokec4 \{\cf3 \strokec3 \
      \cf9 \strokec9 statusCode\cf3 \strokec3 : response\cf4 \strokec4 .\cf3 \strokec3 status\cf4 \strokec4 ,\cf3 \strokec3 \
      \cf9 \strokec9 headers\cf3 \strokec3 : \cf4 \strokec4 \{\cf3 \strokec3  \cf9 \strokec9 "Content-Type"\cf3 \strokec3 : \cf8 \strokec8 "application/json"\cf3 \strokec3  \cf4 \strokec4 \},\cf3 \strokec3 \
      \cf9 \strokec9 body\cf3 \strokec3 : data\cf4 \strokec4 ,\cf3 \strokec3 \
    \cf4 \strokec4 \};\cf3 \strokec3 \
  \cf4 \strokec4 \}\cf3 \strokec3 \
\
  \cf6 \strokec6 if\cf3 \strokec3  \cf4 \strokec4 (\cf3 \strokec3 target === \cf8 \strokec8 "airtable-post"\cf4 \strokec4 )\cf3 \strokec3  \cf4 \strokec4 \{\cf3 \strokec3 \
    \cf6 \strokec6 const\cf3 \strokec3  payload = \cf11 \strokec11 JSON\cf4 \strokec4 .\cf5 \strokec5 parse\cf4 \strokec4 (\cf3 \strokec3 event\cf4 \strokec4 .\cf3 \strokec3 body\cf4 \strokec4 );\cf3 \strokec3 \
    \cf6 \strokec6 const\cf3 \strokec3  response = \cf6 \strokec6 await\cf3 \strokec3  \cf5 \strokec5 fetch\cf4 \strokec4 (\cf3 \strokec3 payload\cf4 \strokec4 .\cf3 \strokec3 url\cf4 \strokec4 ,\cf3 \strokec3  \cf4 \strokec4 \{\cf3 \strokec3 \
      \cf9 \strokec9 method\cf3 \strokec3 : \cf8 \strokec8 "POST"\cf4 \strokec4 ,\cf3 \strokec3 \
      \cf9 \strokec9 headers\cf3 \strokec3 : \cf4 \strokec4 \{\cf3 \strokec3 \
        \cf9 \strokec9 "Authorization"\cf3 \strokec3 : \cf8 \strokec8 `Bearer \cf4 \strokec4 $\{\cf8 \strokec8 process\cf4 \strokec4 .\cf8 \strokec8 env\cf4 \strokec4 .\cf10 \strokec10 AIRTABLE_TOKEN\cf4 \strokec4 \}\cf8 \strokec8 `\cf4 \strokec4 ,\cf3 \strokec3 \
        \cf9 \strokec9 "Content-Type"\cf3 \strokec3 : \cf8 \strokec8 "application/json"\cf4 \strokec4 ,\cf3 \strokec3 \
      \cf4 \strokec4 \},\cf3 \strokec3 \
      \cf9 \strokec9 body\cf3 \strokec3 : \cf11 \strokec11 JSON\cf4 \strokec4 .\cf5 \strokec5 stringify\cf4 \strokec4 (\{\cf3 \strokec3  \cf9 \strokec9 fields\cf3 \strokec3 : payload\cf4 \strokec4 .\cf3 \strokec3 fields \cf4 \strokec4 \}),\cf3 \strokec3 \
    \cf4 \strokec4 \});\cf3 \strokec3 \
    \cf6 \strokec6 const\cf3 \strokec3  data = \cf6 \strokec6 await\cf3 \strokec3  response\cf4 \strokec4 .\cf5 \strokec5 text\cf4 \strokec4 ();\cf3 \strokec3 \
    \cf6 \strokec6 return\cf3 \strokec3  \cf4 \strokec4 \{\cf3 \strokec3 \
      \cf9 \strokec9 statusCode\cf3 \strokec3 : response\cf4 \strokec4 .\cf3 \strokec3 status\cf4 \strokec4 ,\cf3 \strokec3 \
      \cf9 \strokec9 headers\cf3 \strokec3 : \cf4 \strokec4 \{\cf3 \strokec3  \cf9 \strokec9 "Content-Type"\cf3 \strokec3 : \cf8 \strokec8 "application/json"\cf3 \strokec3  \cf4 \strokec4 \},\cf3 \strokec3 \
      \cf9 \strokec9 body\cf3 \strokec3 : data\cf4 \strokec4 ,\cf3 \strokec3 \
    \cf4 \strokec4 \};\cf3 \strokec3 \
  \cf4 \strokec4 \}\cf3 \strokec3 \
\
  \cf6 \strokec6 if\cf3 \strokec3  \cf4 \strokec4 (\cf3 \strokec3 target === \cf8 \strokec8 "airtable-patch"\cf4 \strokec4 )\cf3 \strokec3  \cf4 \strokec4 \{\cf3 \strokec3 \
    \cf6 \strokec6 const\cf3 \strokec3  payload = \cf11 \strokec11 JSON\cf4 \strokec4 .\cf5 \strokec5 parse\cf4 \strokec4 (\cf3 \strokec3 event\cf4 \strokec4 .\cf3 \strokec3 body\cf4 \strokec4 );\cf3 \strokec3 \
    \cf6 \strokec6 const\cf3 \strokec3  response = \cf6 \strokec6 await\cf3 \strokec3  \cf5 \strokec5 fetch\cf4 \strokec4 (\cf3 \strokec3 payload\cf4 \strokec4 .\cf3 \strokec3 url\cf4 \strokec4 ,\cf3 \strokec3  \cf4 \strokec4 \{\cf3 \strokec3 \
      \cf9 \strokec9 method\cf3 \strokec3 : \cf8 \strokec8 "PATCH"\cf4 \strokec4 ,\cf3 \strokec3 \
      \cf9 \strokec9 headers\cf3 \strokec3 : \cf4 \strokec4 \{\cf3 \strokec3 \
        \cf9 \strokec9 "Authorization"\cf3 \strokec3 : \cf8 \strokec8 `Bearer \cf4 \strokec4 $\{\cf8 \strokec8 process\cf4 \strokec4 .\cf8 \strokec8 env\cf4 \strokec4 .\cf10 \strokec10 AIRTABLE_TOKEN\cf4 \strokec4 \}\cf8 \strokec8 `\cf4 \strokec4 ,\cf3 \strokec3 \
        \cf9 \strokec9 "Content-Type"\cf3 \strokec3 : \cf8 \strokec8 "application/json"\cf4 \strokec4 ,\cf3 \strokec3 \
      \cf4 \strokec4 \},\cf3 \strokec3 \
      \cf9 \strokec9 body\cf3 \strokec3 : \cf11 \strokec11 JSON\cf4 \strokec4 .\cf5 \strokec5 stringify\cf4 \strokec4 (\{\cf3 \strokec3  \cf9 \strokec9 fields\cf3 \strokec3 : payload\cf4 \strokec4 .\cf3 \strokec3 fields \cf4 \strokec4 \}),\cf3 \strokec3 \
    \cf4 \strokec4 \});\cf3 \strokec3 \
    \cf6 \strokec6 const\cf3 \strokec3  data = \cf6 \strokec6 await\cf3 \strokec3  response\cf4 \strokec4 .\cf5 \strokec5 text\cf4 \strokec4 ();\cf3 \strokec3 \
    \cf6 \strokec6 return\cf3 \strokec3  \cf4 \strokec4 \{\cf3 \strokec3 \
      \cf9 \strokec9 statusCode\cf3 \strokec3 : response\cf4 \strokec4 .\cf3 \strokec3 status\cf4 \strokec4 ,\cf3 \strokec3 \
      \cf9 \strokec9 headers\cf3 \strokec3 : \cf4 \strokec4 \{\cf3 \strokec3  \cf9 \strokec9 "Content-Type"\cf3 \strokec3 : \cf8 \strokec8 "application/json"\cf3 \strokec3  \cf4 \strokec4 \},\cf3 \strokec3 \
      \cf9 \strokec9 body\cf3 \strokec3 : data\cf4 \strokec4 ,\cf3 \strokec3 \
    \cf4 \strokec4 \};\cf3 \strokec3 \
  \cf4 \strokec4 \}\cf3 \strokec3 \
\
  \cf6 \strokec6 return\cf3 \strokec3  \cf4 \strokec4 \{\cf3 \strokec3  \cf9 \strokec9 statusCode\cf3 \strokec3 : \cf10 \strokec10 400\cf4 \strokec4 ,\cf3 \strokec3  \cf9 \strokec9 body\cf3 \strokec3 : \cf8 \strokec8 "Unknown target"\cf3 \strokec3  \cf4 \strokec4 \};\cf3 \strokec3 \
\pard\pardeftab720\partightenfactor0
\cf4 \strokec4 \};\cf3 \strokec3 \
}