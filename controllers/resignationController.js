
const { admin, db } = require("../config/firebaseConfig");
const axios = require("axios");

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

exports.sendLineNotificationResignation = async (req, res) => {
  console.log("sendLineNotificationResignation ", req.body);
  try {
    const { lineId, message } = req.body; // Get data from frontend

    if (!lineId) {
      return res.status(400).json({ error: 'LINE ID is required' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    


   
    const flex = {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "รายการตรวจสอบรายได้",
            weight: "bold",
            color: "#1DB446",
            size: "sm"
          },
          {
            type: "text",
            text: message.companyName,
            weight: "bold",
            size: "lg",
            margin: "sm"
          },
          {
            type: "text",
            text: message.locationName,
            size: "xs",
            color: "#aaaaaa",
            wrap: true
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "md",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "เลขที่สลิปรายได้",
                    size: "xs",
                    color: "#555555",
                    flex: 0
                  },
                  {
                    type: "text",
                    text: message.incomeSlipNo,
                    size: "xs",
                    color: "#111111",
                    align: "end"
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "วันที่รับรายได้",
                    size: "xs",
                    color: "#555555",
                    flex: 0
                  },
                  {
                    type: "text",
                    text: message.incomeDate,
                    size: "xs",
                    color: "#111111",
                    align: "end"
                  }
                ]
              },

              {
                type: "box",
                layout: "horizontal",
                margin: "sm",
                contents: [
                  {
                    type: "text",
                    text: "ทำการขอโดย",
                    size: "xs",
                    color: "#555555",
                    flex: 0,
                    margin: "none"
                  },
                  {
                    type: "text",
                    text: message.createdByName,
                    size: "xs",
                    color: "#111111",
                    align: "end"
                  }
                ],
                spacing: "none"
              },
              {
                type: "separator"
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    color: "#555555",
                    text: "ประเภทรายได้",
                    size: "xs"
                  },
                  {
                    type: "text",
                    text: message.incomeTypeName,
                    size: "xs",
                    flex: 0
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "ชื่อลูกหนี้",
                    color: "#555555",
                    size: "xs"
                  },
                  {
                    type: "text",
                    text: message.debtorName,
                    flex: 0,
                    size: "xs"
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "จำนวน",
                    color: "#555555",
                    size: "xs"
                  },
                  {
                    type: "text",
                    text: message.incomeAmount,
                    color: "#555555",
                    flex: 0,
                    size: "xs"
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "สถานะ",
                    color: "#555555",
                    size: "xs"
                  },
                  {
                    type: "text",
                    text: message.status,
                    flex: 0,
                    size: "xs",
                    color: "#1DB446"
                  }
                ]
              }
            ]
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "none",
            contents: [
              {
                type: "button",
                action: {
                  type: "uri",
                  label: "Review",
                  uri: "https://nanostores.co.th/login"
                }
              }
            ]
          }
        ]
      },
      styles: {
        footer: {
          separator: true
        }
      }
    };

    const response = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: lineId,
        messages: [{ type: 'flex', altText: 'Resignation Request', contents: flex }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        },
      }
    );

    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('LINE notification error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to send LINE notification' });
  }
};
